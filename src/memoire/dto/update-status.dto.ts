import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { StatutMemoire } from '../../generated/prisma/client.js';

const UpdateStatusSchema = z.object({
  statut: z.enum(StatutMemoire),
  motifRejet: z.string().optional(),
});

export class UpdateStatusDto extends createZodDto(UpdateStatusSchema) {}
