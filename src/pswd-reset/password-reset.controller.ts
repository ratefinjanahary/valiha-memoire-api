import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
// import { Throttle } from '@nestjs/throttler'; // recommandé (limite par IP), cf. notes
import { PasswordResetService } from './password-reset.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ForgotPasswordOtpSchema,
  ResetPasswordOtpSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type ForgotPasswordOtpInput,
  type ResetPasswordOtpInput,
} from './dto/password-reset.schemas.js';

// Même préfixe que AuthController : Nest accepte plusieurs controllers sur le même préfixe
@Controller('api/auth')
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  // ─── Flux par lien ───
  // @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(
    @Body(new ZodValidationPipe(ForgotPasswordSchema)) body: ForgotPasswordInput,
  ) {
    return this.passwordResetService.forgotPassword(body);
  }

  // @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordSchema)) body: ResetPasswordInput,
  ) {
    return this.passwordResetService.resetPassword(body);
  }

  // ─── Flux par code OTP ───
  // La limite "3 codes / heure / e-mail" est appliquée dans le service (compte en base).
  // @Throttle ci-dessous = filet supplémentaire par IP.
  // @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password-otp')
  @HttpCode(HttpStatus.OK)
  forgotPasswordOtp(
    @Body(new ZodValidationPipe(ForgotPasswordOtpSchema)) body: ForgotPasswordOtpInput,
  ) {
    return this.passwordResetService.forgotPasswordOtp(body);
  }

  // Les 5 essais max par code sont appliqués dans le service ; @Throttle = filet par IP.
  // @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset-password-otp')
  @HttpCode(HttpStatus.OK)
  resetPasswordOtp(
    @Body(new ZodValidationPipe(ResetPasswordOtpSchema)) body: ResetPasswordOtpInput,
  ) {
    return this.passwordResetService.resetPasswordOtp(body);
  }
}
