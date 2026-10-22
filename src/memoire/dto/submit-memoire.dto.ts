import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { TypeDiplome } from '../../generated/prisma/client.js';
import { motsClesSchema, toStringArray } from './mots-cles.dto';

/** '' ou null (champ vide d'un formulaire) → undefined */
const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

export const SubmitMemoireSchema = z.object({
  titre: z.string().min(5, { message: 'Le titre doit contenir au moins 5 caractères' }),
  resume: z.string().optional(),
  anneeSoutenance: z.string().regex(/^\d{4}$/, { message: "L'année doit être valide" }),
  typeDiplome: z.enum(TypeDiplome),
  auteurNom: z.string().min(2, { message: "Le nom de l'auteur est requis" }),
  auteurPrenom: z.string().min(2, { message: "Le prénom de l'auteur est requis" }),
  auteurEmail: z.email({ message: "Email de l'auteur invalide" }),
  universiteId: z.uuid({ message: 'ID université invalide' }),
  domaineId: z.uuid({ message: 'ID domaine invalide' }),

  // Au moins un encadreur obligatoire
  encadreurIds: z.preprocess(
    toStringArray,
    z
      .array(z.uuid({ message: 'ID encadreur invalide' }), { message: 'Au moins un encadreur est requis' })
      .min(1, { message: 'Au moins un encadreur est requis' })
      .max(5, { message: '5 encadreurs maximum' }),
  ),

  // Optionnel : l'auteur du mémoire est lui-même un encadreur déjà enregistré
  auteurEncadreurId: z
    .preprocess(emptyToUndefined, z.uuid({ message: 'ID encadreur auteur invalide' }).optional())
    .optional(),

  // Optionnel : absent ou vide → extraction IA ; sinon chaque mot est ensuite mappé vers un descripteur UNESCO
  motsCles: motsClesSchema.optional(),
});

export class SubmitMemoireDto extends createZodDto(SubmitMemoireSchema) {}