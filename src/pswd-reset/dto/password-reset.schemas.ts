import { z } from 'zod';

// Champ mot de passe partagé (lien + OTP)
// bcrypt tronque silencieusement au-delà de 72 octets : on borne explicitement
const passwordField = z
  .string()
  .min(8, { message: 'Le mot de passe doit faire au moins 8 caractères' })
  .max(72, { message: 'Le mot de passe ne doit pas dépasser 72 caractères' });

// ─── Flux par lien ─────────────────────────────────────────────
export const ForgotPasswordSchema = z.object({
  // Pas de .toLowerCase() : la recherche en base est insensible à la casse (cf. service)
  email: z.email({ message: 'Email invalide' }).trim(),
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
  // randomBytes(32).toString('hex') => exactement 64 caractères hexadécimaux.
  token: z.string().regex(/^[a-f0-9]{64}$/i, { message: 'Token invalide' }),
  newPassword: passwordField,
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

// ─── Flux par code OTP ─────────────────────────────────────────
export const ForgotPasswordOtpSchema = ForgotPasswordSchema;
export type ForgotPasswordOtpInput = ForgotPasswordInput;

export const ResetPasswordOtpSchema = z.object({
  email: z.email({ message: 'Email invalide' }).trim(),
  // Exactement 6 chiffres (randomInt(100000, 1000000))
  code: z.string().regex(/^\d{6}$/, { message: 'Le code doit contenir 6 chiffres' }),
  newPassword: passwordField,
});
export type ResetPasswordOtpInput = z.infer<typeof ResetPasswordOtpSchema>;
