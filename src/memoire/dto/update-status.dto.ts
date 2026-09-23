import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { StatutMemoire } from '@prisma/client';

const UpdateStatusSchema = z.object({
  statut: z.nativeEnum(StatutMemoire),
  motifRejet: z.string().optional(),
});

export class UpdateStatusDto extends createZodDto(UpdateStatusSchema) {}
