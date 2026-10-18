import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    nom: z.string().trim().min(1, 'Le nom est requis').max(100).optional(),
    prenom: z.string().trim().min(1, 'Le prénom est requis').max(100).optional(),
    email: z.string().trim().email('Email invalide').optional(),
    currentPassword: z.string().min(1, 'Mot de passe actuel requis').optional(),
    newPassword: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
      .max(72, 'Le mot de passe est trop long (72 max, limite de bcrypt)')
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const { nom, prenom, email, newPassword, currentPassword } = data;

    if (!nom && !prenom && !email && !newPassword) {
      ctx.addIssue({ code: 'custom', message: 'Aucune modification fournie', path: [] });
    }

    // Changer l'email ou le mot de passe exige le mot de passe actuel
    if ((email || newPassword) && !currentPassword) {
      ctx.addIssue({
        code: 'custom',
        message: 'Le mot de passe actuel est requis pour modifier l’email ou le mot de passe',
        path: ['currentPassword'],
      });
    }

    if (newPassword && currentPassword && newPassword === currentPassword) {
      ctx.addIssue({
        code: 'custom',
        message: "Le nouveau mot de passe doit être différent de l’actuel",
        path: ['newPassword'],
      });
    }
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;