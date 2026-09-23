import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const SearchSemanticSchema = z.object({
  query: z.string().min(3, { message: 'La requête doit contenir au moins 3 caractères' }),
});

export class SearchSemanticDto extends createZodDto(SearchSemanticSchema) {}
