import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { TypeDiplome } from '@prisma/client';

const SearchQuerySchema = z.object({
  q: z.string().optional(),
  annee: z.string().regex(/^\d{4}$/, { message: "L'année doit être valide" }).optional(),
  universiteId: z.string().uuid({ message: "L'ID de l'université doit être un UUID valide" }).optional(),
  domaineId: z.string().uuid({ message: "L'ID du domaine doit être un UUID valide" }).optional(),
  typeDiplome: z.nativeEnum(TypeDiplome).optional(),
});

export class SearchQueryDto extends createZodDto(SearchQuerySchema) {}
