import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
// Si ton client Prisma est généré ailleurs (output custom), adapte cet import de type
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MailService } from '../mail/mail.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../common/audit.actions.js';
import type {
  ForgotPasswordInput,
  ResetPasswordInput,
  ForgotPasswordOtpInput,
  ResetPasswordOtpInput,
} from './dto/password-reset.schemas.js';

// ─── Flux par lien ───
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 min
const RESEND_COOLDOWN_MS = 60 * 1000; // anti mail-bombing : 1 mail / minute / user
const GENERIC_MESSAGE =
  "Si un compte correspond à cet e-mail, un lien de réinitialisation vient d'être envoyé.";

// ─── Flux par code OTP ───
const OTP_TTL_MS = 10 * 60 * 1000; // 10 min
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_REQUESTS_PER_HOUR = 3; // par utilisateur
const OTP_COOLDOWN_MS = 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const GENERIC_OTP_MESSAGE =
  "Si un compte correspond à cet e-mail, un code de vérification vient d'être envoyé.";

/**
 * SHA-256 et non bcrypt pour le token de lien : 256 bits d'entropie (inutile de ralentir
 * le hash), et on a besoin d'un hash déterministe pour retrouver la ligne par `tokenHash`.
 */
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/**
 * Hash du code OTP : HMAC-SHA256 (clé serveur + userId), pas un SHA-256 "nu".
 * Un code à 6 chiffres n'a que 1 000 000 de valeurs : un SHA-256 simple se casse en
 * quelques millisecondes par quiconque lit la base. Avec la clé serveur, une fuite de
 * la base seule ne permet plus de retrouver le code.
 */
const hashOtp = (userId: string, code: string) => {
  const secret = process.env.OTP_HASH_SECRET ?? process.env.JWT_SECRET;
  if (!secret) throw new Error('OTP_HASH_SECRET (ou JWT_SECRET) doit être défini');
  return createHmac('sha256', secret).update(`${userId}:${code}`).digest('hex');
};

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  //  Helpers partagés (lien + OTP) : une seule logique bcrypt / invalidation
  // ═══════════════════════════════════════════════════════════════

  /** Recherche insensible à la casse (findUnique ne supporte pas `mode`). */
  private findActiveUserByEmail(email: string) {
    return this.prisma.user
      .findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
      .then((user) => (user && user.isActif ? user : null));
  }

  /** bcrypt (cohérent avec register/login) — hors transaction car coûteux en CPU. */
  private hashPassword(plain: string) {
    return bcrypt.hash(plain, 10);
  }

  /**
   * Applique le nouveau mot de passe et invalide tout le reste, dans la transaction appelante :
   *  - passwordChangedAt => invalide tous les JWT émis avant (cf. JwtStrategy)
   *  - purge de TOUS les tokens de lien ET codes OTP en attente (un flux ne laisse pas l'autre ouvert)
   */
  private async applyPasswordChange(
    tx: Prisma.TransactionClient,
    userId: string,
    passwordHash: string,
  ) {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
    await tx.passwordResetToken.deleteMany({ where: { userId } });
    await tx.passwordResetCode.deleteMany({ where: { userId } });
  }

  // ═══════════════════════════════════════════════════════════════
  //  Flux par lien
  // ═══════════════════════════════════════════════════════════════

  // ─── POST /auth/forgot-password ───────────────────────────────
  async forgotPassword({ email }: ForgotPasswordInput) {
    // SÉCURITÉ (anti-énumération) : traitement en arrière-plan, réponse immédiate.
    // Ni le contenu ni le temps de réponse ne révèlent si le compte existe.
    void this.sendResetLink(email).catch((err: Error) =>
      // On ne logge ni l'e-mail ni le token
      this.logger.error(`forgot-password: ${err.message}`),
    );
    return { message: GENERIC_MESSAGE };
  }

  private async sendResetLink(email: string) {
    const user = await this.findActiveUserByEmail(email);
    if (!user) return; // silence : même réponse côté client

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

    const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
    const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

    // Le token en clair n'existe qu'ici et dans l'e-mail
    await this.mailService.sendPasswordResetEmail(user.email, resetUrl);

    this.auditService.log(AuditAction.FORGOT_PASSWORD, user.id, 'reset_requested');
  }

  // ─── POST /auth/reset-password ────────────────────────────────
  async resetPassword({ token, newPassword }: ResetPasswordInput) {
    // Message unique pour tous les cas d'échec (inconnu/expiré/déjà utilisé)
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

    const passwordHash = await this.hashPassword(newPassword);

    await this.prisma.$transaction(async (tx) => {
      // SÉCURITÉ (usage unique, anti race-condition) : DELETE conditionnel.
      // Deux requêtes parallèles avec le même token : une seule obtient count === 1.
      const claimed = await tx.passwordResetToken.deleteMany({
        where: { id: record.id, expiresAt: { gt: new Date() } },
      });
      if (claimed.count !== 1) throw invalid(); // rollback

      await this.applyPasswordChange(tx, record.userId, passwordHash);
    });

    this.auditService.log(AuditAction.RESET_PASSWORD, record.userId, 'password_reset_done');
    return { message: 'Mot de passe réinitialisé avec succès' };
  }

  // ═══════════════════════════════════════════════════════════════
  //  Flux par code OTP
  // ═══════════════════════════════════════════════════════════════

  // ─── POST /auth/forgot-password-otp ───────────────────────────
  async forgotPasswordOtp({ email }: ForgotPasswordOtpInput) {
    // Même principe anti-énumération que le flux par lien : réponse immédiate et identique.
    void this.sendOtp(email).catch((err: Error) =>
      this.logger.error(`forgot-password-otp: ${err.message}`),
    );
    return { message: GENERIC_OTP_MESSAGE };
  }

  private async sendOtp(email: string) {
    const user = await this.findActiveUserByEmail(email);
    if (!user) return;

    // RATE LIMIT par utilisateur (3 codes / heure + 1 / minute), compté en base.
    // Dépassement => on n'envoie rien, SILENCIEUSEMENT : un 429 propre à l'e-mail
    // révélerait que le compte existe. (Le throttler par IP, lui, répond 429 à tout le monde.)
    const now = Date.now();
    const hourAgo = new Date(now - HOUR_MS);
    const recent = await this.prisma.passwordResetCode.findMany({
      where: { userId: user.id, createdAt: { gt: hourAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    if (recent.length >= OTP_MAX_REQUESTS_PER_HOUR) return;
    if (recent[0] && now - recent[0].createdAt.getTime() < OTP_COOLDOWN_MS) return;

    // CSPRNG, uniforme sur [100000, 999999] => toujours 6 chiffres
    const code = randomInt(100000, 1000000).toString();

    // On NE purge PAS les codes récents (ils servent au comptage ci-dessus) ;
    // seul le plus récent non expiré est accepté à la vérification.
    await this.prisma.$transaction([
      this.prisma.passwordResetCode.deleteMany({
        where: { userId: user.id, createdAt: { lte: hourAgo } },
      }),
      this.prisma.passwordResetCode.create({
        data: {
          codeHash: hashOtp(user.id, code),
          userId: user.id,
          expiresAt: new Date(now + OTP_TTL_MS),
        },
      }),
    ]);

    // Le code en clair n'existe qu'ici et dans l'e-mail
    await this.mailService.sendPasswordResetCodeEmail(user.email, code);

    this.auditService.log(AuditAction.FORGOT_PASSWORD, user.id, 'otp_requested');
  }

  // ─── POST /auth/reset-password-otp ────────────────────────────
  async resetPasswordOtp({ email, code, newPassword }: ResetPasswordOtpInput) {
    // Message unique pour tous les échecs (inconnu / expiré / trop d'essais / mauvais code)
    const invalid = () => new BadRequestException('Code invalide ou expiré');

    const user = await this.findActiveUserByEmail(email);
    if (!user) throw invalid();

    // Seul le code le plus récent et non expiré est valable
    const record = await this.prisma.passwordResetCode.findFirst({
      where: { userId: user.id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw invalid();

    // SÉCURITÉ (anti brute-force) : on RÉSERVE l'essai AVANT de comparer, de façon atomique.
    // Même avec 100 requêtes parallèles, au plus 5 passent cette étape (attempts < 5).
    const reserved = await this.prisma.passwordResetCode.updateMany({
      where: { id: record.id, attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (reserved.count !== 1) {
      // Plafond atteint : le code est invalidé définitivement
      await this.prisma.passwordResetCode.deleteMany({ where: { id: record.id } });
      throw invalid();
    }

    // Comparaison en temps constant des deux hash (32 octets chacun)
    const expected = Buffer.from(record.codeHash, 'hex');
    const given = Buffer.from(hashOtp(user.id, code), 'hex');
    const matches = expected.length === given.length && timingSafeEqual(expected, given);

    if (!matches) {
      // L'essai est déjà compté ; si c'était le dernier, on détruit le code
      await this.prisma.passwordResetCode.deleteMany({
        where: { id: record.id, attempts: { gte: OTP_MAX_ATTEMPTS } },
      });
      this.auditService.log(AuditAction.RESET_PASSWORD, user.id, 'otp_failed_attempt');
      throw invalid();
    }

    const passwordHash = await this.hashPassword(newPassword);

    await this.prisma.$transaction(async (tx) => {
      // Usage unique : consommation par DELETE conditionnel (cf. flux par lien)
      const claimed = await tx.passwordResetCode.deleteMany({
        where: { id: record.id, expiresAt: { gt: new Date() } },
      });
      if (claimed.count !== 1) throw invalid(); // rollback

      await this.applyPasswordChange(tx, user.id, passwordHash);
    });

    this.auditService.log(AuditAction.RESET_PASSWORD, user.id, 'otp_password_reset_done');
    return { message: 'Mot de passe réinitialisé avec succès' };
  }
}