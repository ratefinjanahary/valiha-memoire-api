import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../common/audit.actions.js';
import type { ForgotPasswordInput, ResetPasswordInput } from './dto/password-reset.schemas.js';

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 min
const RESEND_COOLDOWN_MS = 60 * 1000; // anti mail-bombing : 1 mail / minute / user
const GENERIC_MESSAGE =
  'Si un compte correspond à cet e-mail, un lien de réinitialisation vient d\'être envoyé.';

/**
 * SHA-256 et non bcrypt : le token a 256 bits d'entropie (inutile de ralentir le hash),
 * et on a besoin d'un hash déterministe pour retrouver la ligne par `tokenHash`.
 */
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
  ) {}

  // ─── POST /auth/forgot-password ───────────────────────────────
  async forgotPassword({ email }: ForgotPasswordInput) {
    // SÉCURITÉ (anti-énumération) : le traitement est lancé en arrière-plan et on répond
    // immédiatement. Ainsi ni le contenu de la réponse, ni son temps de réponse
    // (envoi d'e-mail = lent) ne révèlent si le compte existe.
    void this.sendResetLink(email).catch((err: Error) =>
      // On ne logge ni l'e-mail ni le token
      this.logger.error(`forgot-password: ${err.message}`),
    );
    return { message: GENERIC_MESSAGE };
  }

  private async sendResetLink(email: string) {
    // Recherche insensible à la casse (findUnique ne supporte pas `mode`)
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (!user || !user.isActif) return; // silence : même réponse côté client

    // Cooldown : évite qu'on spamme la boîte d'un utilisateur
    const recent = await this.prisma.passwordResetToken.findFirst({
      where: { userId: user.id, createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) } },
    });
    if (recent) return;

    const rawToken = randomBytes(32).toString('hex'); // 64 car. hex, CSPRNG
    const tokenHash = sha256(rawToken);

    // Un seul token actif par user : on purge les anciens puis on crée le nouveau (atomique)
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      this.prisma.passwordResetToken.create({
        data: { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
      }),
    ]);

    const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:3100').replace(/\/+$/, '');
    const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

    // Le token en clair n'existe qu'ici et dans l'e-mail
    await this.mailService.sendPasswordResetEmail(user.email, resetUrl);

    this.auditService.log(AuditAction.FORGOT_PASSWORD, user.id, 'reset_requested');
  }

  // ─── POST /auth/reset-password ────────────────────────────────
  async resetPassword({ token, newPassword }: ResetPasswordInput) {
    // Message unique pour tous les cas d'échec : on ne dit pas pourquoi (inconnu/expiré/déjà utilisé)
    const invalid = () => new BadRequestException('Lien invalide ou expiré');

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: { select: { isActif: true } } },
    });
    if (!record) throw invalid();

    if (record.expiresAt <= new Date() || !record.user.isActif) {
      await this.prisma.passwordResetToken.deleteMany({ where: { id: record.id } });
      throw invalid();
    }

    // bcrypt (cohérent avec register/login) — fait hors transaction car coûteux en CPU
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      // SÉCURITÉ (usage unique, anti race-condition) : on "consomme" le token via un
      // DELETE conditionnel. Si deux requêtes arrivent en parallèle avec le même token,
      // une seule obtient count === 1, l'autre est rejetée.
      const claimed = await tx.passwordResetToken.deleteMany({
        where: { id: record.id, expiresAt: { gt: new Date() } },
      });
      if (claimed.count !== 1) throw invalid(); // rollback de toute la transaction

      await tx.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          // Invalide tous les JWT émis avant cet instant (cf. jwt.strategy.snippet.ts)
          passwordChangedAt: new Date(),
        },
      });

      // Révoque tout autre token de reset en attente pour ce user
      await tx.passwordResetToken.deleteMany({ where: { userId: record.userId } });

      // Si tu ajoutes un jour des refresh tokens / sessions en base, révoque-les ici :
      // await tx.refreshToken.deleteMany({ where: { userId: record.userId } });
    });

    this.auditService.log(AuditAction.RESET_PASSWORD, record.userId, 'password_reset_done');
    return { message: 'Mot de passe réinitialisé avec succès' };
  }
}
