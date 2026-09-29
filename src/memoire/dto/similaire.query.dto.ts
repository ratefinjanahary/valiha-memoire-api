import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const SimilaireQuerySchema = z.object({
  /** Nombre de mémoires similaires à retourner (max 20) */
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export class SimilaireQueryDto extends createZodDto(SimilaireQuerySchema) {}
