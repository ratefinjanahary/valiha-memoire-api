import { z } from 'zod';

export const STATUTS_MEMOIRE = ['BROUILLON', 'EN_ATTENTE_MODERATION', 'VALIDE', 'REJETTE'] as const;
export const TYPES_DIPLOME = ['LICENCE', 'MASTER', 'DOCTORAT'] as const;

const ANNEE_MIN = 1950;

/* PATCH /api/moderation/memoires/:id */

export const updateMemoireSchema = z
  .object({
    titre: z.string().trim().min(3, 'Titre trop court').max(300, 'Titre trop long (300 max)'),
    resume: z.string().trim().min(1, 'Le résumé ne peut pas être vide').max(20000, 'Résumé trop long'),
    anneeSoutenance: z.coerce
      .number()
      .int('Année invalide')
      .min(ANNEE_MIN, `Année minimale : ${ANNEE_MIN}`)
      .refine((a) => a <= new Date().getFullYear(), 'Année dans le futur'),
    typeDiplome: z.enum(TYPES_DIPLOME),
    auteurNom: z.string().trim().min(1, "Nom de l'auteur requis").max(100),
    auteurPrenom: z.string().trim().min(1, "Prénom de l'auteur requis").max(100),
    auteurEmail: z.string().trim().toLowerCase().email('Email invalide').max(255).nullable(),
    universiteId: z.uuid('universiteId invalide'),
    domaineId: z.uuid('domaineId invalide'),
    /** null = l'auteur n'est pas un encadreur enregistré */
    auteurEncadreurId: z.uuid('auteurEncadreurId invalide').nullable(),
    /** Remplace la liste complète des encadreurs */
    encadreurIds: z.array(z.uuid('encadreurId invalide')).min(1, 'Au moins un encadreur').max(10),
    /** Remplace la liste complète des mots-clés. Tableau vide => régénération par l'IA */
    motsCles: z.array(z.string().trim().min(2).max(50)).max(10, '10 mots-clés maximum'),
  })
  .partial()
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'Aucun champ à modifier',
  });

export type UpdateMemoireInput = z.infer<typeof updateMemoireSchema>;

/* GET /api/moderation/memoires?statut=&page=&limit= */

export const listModerationQuerySchema = z.object({
  /** Absent = tous les statuts */
  statut: z.enum(STATUTS_MEMOIRE).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export type ListModerationQuery = z.infer<typeof listModerationQuerySchema>;