import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../auth/role.enum.js';

const MAX_BULK_DELETE = 100;

@Controller('api/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Roles(Role.ADMIN)
  @Get()
  async getAuditLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number
  ) {
    return this.auditService.findAll(page);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    // ⚠️ adapte `req.user?.id` à ce que ta JwtStrategy met dans req.user (id, userId, sub…)
    @Req() req: { user?: { id?: string } },
  ) {
    return this.auditService.remove(id, req.user?.id);
  }

  // POST plutôt que DELETE + body : certains proxys suppriment le body des DELETE
  @Roles(Role.ADMIN)
  @Post('bulk-delete')
  @HttpCode(200)
  async removeMany(
    @Body('ids') ids: unknown,
    @Req() req: { user?: { id?: string } },
  ) {
    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      ids.length > MAX_BULK_DELETE ||
      !ids.every((id) => typeof id === 'string')
    ) {
      throw new BadRequestException(
        `"ids" doit être un tableau de 1 à ${MAX_BULK_DELETE} identifiants`,
      );
    }

    return this.auditService.removeMany(ids as string[], req.user?.id);
  }
}