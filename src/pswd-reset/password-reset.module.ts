import { Module } from '@nestjs/common';
import { PasswordResetController } from './password-reset.controller.js';
import { PasswordResetService } from './password-reset.service.js';
import { MailModule } from '../mail/mail.module.js';

// Si PrismaModule / AuditModule ne sont pas @Global(), ajoute-les dans `imports`.
@Module({
  imports: [MailModule],
  controllers: [PasswordResetController],
  providers: [PasswordResetService],
})
export class PasswordResetModule {}
