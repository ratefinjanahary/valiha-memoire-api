import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const SearchMemoireSchema = z.object({
  /** Termes de recherche */
  q: z.string().transform((v) => v.trim() || undefined).pipe(z.string().min(1).optional()).optional(),
  /**
   * mode=any → mémoire contenant AU MOINS UN des mots
   * mode=all → mémoire contenant TOUS les mots
   */
  mode: z.enum(['any', 'all']).default('any'),
  annee: z.coerce.number().int().min(1900).max(2100).optional(),
  typeDiplome: z.enum(['LICENCE', 'MASTER', 'DOCTORAT']).optional(),
  universiteId: z.uuid().optional(),
  domaineId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export class SearchMemoireDto extends createZodDto(SearchMemoireSchema) {}
