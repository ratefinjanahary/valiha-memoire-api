import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateDomaineSchema = z.object({
  nom: z.string().min(2, { message: 'Le nom du domaine est requis' }),
  description: z.string().optional(),
});

export class CreateDomaineDto extends createZodDto(CreateDomaineSchema) {}
