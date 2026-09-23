import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Role } from '../role.enum.js';

const RegisterSchema = z.object({
  email: z.string().email({ message: 'Email invalide' }),
  password: z.string().min(6, { message: 'Le mot de passe doit contenir au moins 6 caractères' }),
  nom: z.string().min(2, { message: 'Le nom doit contenir au moins 2 caractères' }),
  prenom: z.string().min(2, { message: 'Le prénom doit contenir au moins 2 caractères' }),
  role: z.nativeEnum(Role).optional(),
});

export class RegisterDto extends createZodDto(RegisterSchema) {}
