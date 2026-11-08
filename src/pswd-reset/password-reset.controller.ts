import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
// import { Throttle } from '@nestjs/throttler'; // recommandé, cf. notes
import { PasswordResetService } from './password-reset.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  ForgotPasswordSchema,
  ResetPasswordSchema,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from './dto/password-reset.schemas.js';

// Même préfixe que AuthController : Nest accepte plusieurs controllers sur le même préfixe
@Controller('api/auth')
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

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
}
