import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const ConsultationsQuerySchema = z.object({
  annee: z.coerce.number().int().min(1900).max(2100).optional(),
  mois: z.coerce.number().int().min(1).max(12).optional(),
});

export class ConsultationsQueryDto extends createZodDto(ConsultationsQuerySchema) {}
