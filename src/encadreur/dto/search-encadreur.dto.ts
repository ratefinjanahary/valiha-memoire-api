import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const SearchEncadreurSchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export class SearchEncadreurDto extends createZodDto(SearchEncadreurSchema) {}
