import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Role } from '../role.enum.js';

const UpdateRoleSchema = z.object({
  role: z.enum(Role),
});

export class UpdateRoleDto extends createZodDto(UpdateRoleSchema) {}
