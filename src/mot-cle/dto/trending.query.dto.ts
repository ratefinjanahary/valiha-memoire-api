import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const TrendingQuerySchema = z.object({
  /** Nombre de mots-clés à retourner (max 50) */
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export class TrendingQueryDto extends createZodDto(TrendingQuerySchema) {}
