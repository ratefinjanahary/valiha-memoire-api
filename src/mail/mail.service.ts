import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

interface MailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly sender: string;

  constructor() {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) {
      // Fail fast : mieux vaut planter au démarrage qu'au premier "mot de passe oublié"
      throw new Error('GMAIL_USER et GMAIL_APP_PASSWORD doivent être définis');
    }

    this.sender = user;
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // TLS direct
      // Mot de passe d'APPLICATION Google (16 car.), jamais le mot de passe du compte
      auth: { user, pass },
    });
  }

  /** Vérifie les identifiants SMTP au démarrage (log seulement, ne bloque pas l'app). */
  async onModuleInit() {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP Gmail prêt');
    } catch (err) {
      this.logger.error(`SMTP Gmail indisponible: ${(err as Error).message}`);
    }
  }

  // ─── Flux par lien ───────────────────────────────────────────
  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.deliver({
      to,
      subject: 'Réinitialisation de votre mot de passe',
      html: `
        <p>Bonjour,</p>
        <p>Vous avez demandé la réinitialisation de votre mot de passe.
           Ce lien est valable <strong>30 minutes</strong> et ne peut être utilisé qu'une seule fois :</p>
        <p><a href="${resetUrl}">Choisir un nouveau mot de passe</a></p>
        <p>Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail.</p>
      `,
      text: `Réinitialisez votre mot de passe (valable 30 min, usage unique) : ${resetUrl}`,
    });
  }

  // ─── Flux par code OTP ───────────────────────────────────────
  async sendPasswordResetCodeEmail(to: string, code: string): Promise<void> {
    await this.deliver({
      to,
      subject: `Votre code de vérification : ${code}`,
      html: `
        <p>Bonjour,</p>
        <p>Voici votre code pour réinitialiser votre mot de passe :</p>
        <p style="font-family:monospace;font-size:28px;font-weight:bold;letter-spacing:6px;margin:16px 0">${code}</p>
        <p>Il est valable <strong>10 minutes</strong>. Si vous avez demandé plusieurs codes, utilisez le plus récent.</p>
        <p>Ne le communiquez à personne. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>
      `,
      text: `Votre code de réinitialisation : ${code} (valable 10 minutes, utilisez le plus récent si vous en avez demandé plusieurs). Ne le communiquez à personne.`,
    });
  }

  // ─── Envoi commun ────────────────────────────────────────────
  private async deliver({ to, subject, html, text }: MailPayload): Promise<void> {
    try {
      await this.transporter.sendMail({
        // Gmail réécrit de toute façon l'expéditeur avec le compte authentifié
        from: `"Valiha" <${this.sender}>`,
        to,
        subject,
        html,
        text,
      });
    } catch (err) {
      // SÉCURITÉ : ne jamais logger le contenu du mail (lien/code en clair), ni le destinataire
      this.logger.error(`Échec d'envoi SMTP: ${(err as Error).message}`);
      throw new Error("Envoi de l'e-mail impossible");
    }
  }
}
