import { z } from 'zod';

export const MOTS_CLES_MAX = 10;
export const MOT_CLE_MIN_LENGTH = 2;
export const MOT_CLE_MAX_LENGTH = 50;

/**
 * La soumission est en multipart/form-data : une liste arrive soit en champ répété
 * (motsCles=a&motsCles=b → array), soit en string unique, soit en JSON / CSV.
 */
export const toStringArray = (v: unknown) => {
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

/** Un mot-clé : NFC, caractères de contrôle retirés, espaces compactés, 2–50 caractères, au moins une lettre */
export const motCleSchema = z
  .string({ message: 'Un mot-clé doit être une chaîne de caractères' })
  .transform((s) => s.normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim())
  .pipe(
    z
      .string()
      .min(MOT_CLE_MIN_LENGTH, { message: `Un mot-clé doit contenir au moins ${MOT_CLE_MIN_LENGTH} caractères` })
      .max(MOT_CLE_MAX_LENGTH, { message: `Un mot-clé ne doit pas dépasser ${MOT_CLE_MAX_LENGTH} caractères` })
      .regex(/\p{L}/u, { message: 'Un mot-clé doit contenir au moins une lettre' }),
  );

/** Doublons supprimés (insensible à la casse, accents conservés), puis plafond de MOTS_CLES_MAX */
export const motsClesSchema = z.preprocess(
  toStringArray,
  z
    .array(motCleSchema, { message: 'motsCles doit être une liste de mots-clés' })
    .transform((list) => {
      const seen = new Set<string>();
      return list.filter((m) => {
        const key = m.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    })
    .pipe(z.array(z.string()).max(MOTS_CLES_MAX, { message: `${MOTS_CLES_MAX} mots-clés maximum` })),
);

export type MotsClesInput = z.infer<typeof motsClesSchema>;