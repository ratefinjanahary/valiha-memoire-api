import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { TypeDiplome } from '@prisma/client';

/** '' ou null (champ vide d'un formulaire) → undefined */
const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

/**
 * La soumission est en multipart/form-data : une liste arrive soit en champ répété
 * (encadreurIds=a&encadreurIds=b → array), soit en string unique, soit en JSON / CSV.
 */
const toStringArray = (v: unknown) => {
  if (Array.isArray(v)) return v;
  if (typeof v !== 'string') return v;
  const s = v.trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      return JSON.parse(s);
    } catch {
      return v;
    }
  }
  return s.split(',').map((x) => x.trim()).filter(Boolean);
};

const SubmitMemoireSchema = z.object({
  titre: z.string().min(5, { message: 'Le titre doit contenir au moins 5 caractères' }),
  resume: z.string().optional(),
  anneeSoutenance: z.string().regex(/^\d{4}$/, { message: "L'année doit être valide" }),
  typeDiplome: z.enum(TypeDiplome),
  auteurNom: z.string().min(2, { message: 'Le nom de l\'auteur est requis' }),
  auteurPrenom: z.string().min(2, { message: 'Le prénom de l\'auteur est requis' }),
  auteurEmail: z.email({ message: 'Email de l\'auteur invalide' }),
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
});

export class SubmitMemoireDto extends createZodDto(SubmitMemoireSchema) {}