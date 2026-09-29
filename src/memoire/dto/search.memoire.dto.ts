import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const SearchMemoireSchema = z.object({
  /** Termes de recherche */
  q: z.string().min(1).optional(),
  /**
   * mode=any → mémoire contenant AU MOINS UN des mots
   * mode=all → mémoire contenant TOUS les mots
   */
  mode: z.enum(['any', 'all']).default('any'),
  annee: z.coerce.number().int().min(1900).max(2100).optional(),
  typeDiplome: z.enum(['LICENCE', 'MASTER', 'DOCTORAT']).optional(),
  universiteId: z.string().uuid().optional(),
  domaineId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export class SearchMemoireDto extends createZodDto(SearchMemoireSchema) {}
