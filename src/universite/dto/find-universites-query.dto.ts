import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const findUniversitesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  /** Recherche sur le nom ou le sigle */
  q: z.string().trim().max(100).optional(),
});

export class FindUniversitesQueryDto extends createZodDto(findUniversitesQuerySchema) {}