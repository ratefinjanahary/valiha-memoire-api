import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const PopulariteQuerySchema = z.object({
  /** Nombre de mémoires dans le classement global (max 100) */
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export class PopulariteQueryDto extends createZodDto(PopulariteQuerySchema) {}
