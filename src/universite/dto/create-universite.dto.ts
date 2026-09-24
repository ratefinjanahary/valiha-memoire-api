import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateUniversiteSchema = z.object({
  nom: z.string().min(2, { message: "Le nom de l'université est requis" }),
  sigle: z.string().optional(),
  ville: z.string().min(2, { message: 'La ville est requise' }),
});

export class CreateUniversiteDto extends createZodDto(CreateUniversiteSchema) {}
