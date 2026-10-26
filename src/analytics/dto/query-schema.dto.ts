import { z } from 'zod';

/** Première année de la fenêtre (la fenêtre fait toujours 5 ans). */
export const evolutionQuerySchema = z.object({
  anneeDebut: z.coerce.number().int().min(1900).max(2100).optional(),
});

/** IDs d'universités séparés par des virgules : ?universiteIds=a,b,c (5 max). */
export const repartitionQuerySchema = z.object({
  universiteIds: z
    .preprocess(
      (value) =>
        typeof value === 'string'
          ? value.split(',').map((s) => s.trim()).filter(Boolean)
          : value,
      z.array(z.string().min(1)).max(5),
    )
    .optional(),
});

export type EvolutionQuery = z.infer<typeof evolutionQuerySchema>;
export type RepartitionQuery = z.infer<typeof repartitionQuerySchema>;