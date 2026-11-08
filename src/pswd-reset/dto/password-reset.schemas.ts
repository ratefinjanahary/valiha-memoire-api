import { z } from 'zod';

export const ForgotPasswordSchema = z.object({
  // Pas de .toLowerCase() : la recherche en base est insensible à la casse (cf. service)
  email: z.email({ message: 'Email invalide' }).trim(),
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
  // randomBytes(32).toString('hex') => exactement 64 caractères hexadécimaux.
  // Rejeter tout le reste dès la validation évite des requêtes DB inutiles.
  token: z.string().regex(/^[a-f0-9]{64}$/i, { message: 'Token invalide' }),
  newPassword: z
    .string()
    .min(8, { message: 'Le mot de passe doit faire au moins 8 caractères' })
    // bcrypt tronque silencieusement au-delà de 72 octets : on borne explicitement
    .max(72, { message: 'Le mot de passe ne doit pas dépasser 72 caractères' }),
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
