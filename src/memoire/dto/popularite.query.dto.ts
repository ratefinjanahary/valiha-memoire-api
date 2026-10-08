import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const PopulariteQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export class PopulariteQueryDto extends createZodDto(PopulariteQuerySchema) {}
