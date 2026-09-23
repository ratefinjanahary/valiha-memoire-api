import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { TypeDiplome } from '@prisma/client';

const SubmitMemoireSchema = z.object({
  titre: z.string().min(5, { message: 'Le titre doit contenir au moins 5 caractères' }),
  resume: z.string().optional(),
  anneeSoutenance: z.string().regex(/^\d{4}$/, { message: "L'année doit être valide" }),
  typeDiplome: z.nativeEnum(TypeDiplome),
  auteurNom: z.string().min(2, { message: 'Le nom de l\'auteur est requis' }),
  auteurPrenom: z.string().min(2, { message: 'Le prénom de l\'auteur est requis' }),
  auteurEmail: z.string().email({ message: 'Email de l\'auteur invalide' }),
  universiteId: z.string().uuid({ message: 'ID université invalide' }),
  domaineId: z.string().uuid({ message: 'ID domaine invalide' }),
});

export class SubmitMemoireDto extends createZodDto(SubmitMemoireSchema) {}
