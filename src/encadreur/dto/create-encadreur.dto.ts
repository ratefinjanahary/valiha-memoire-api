import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

const CreateEncadreurSchema = z.object({
  nom: z.string().trim().min(2, { message: 'Le nom est requis' }),
  prenom: z.string().trim().min(2, { message: 'Le prénom est requis' }),
  titre: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()).optional(),
  email: z.preprocess(emptyToUndefined, z.email({ message: 'Email invalide' }).optional()).optional(),
});

export class CreateEncadreurDto extends createZodDto(CreateEncadreurSchema) {}
