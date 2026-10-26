import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { ZodType } from 'zod';
import { AnalyticsService } from './analytics.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../auth/role.enum.js';
import { ConsultationsQueryDto } from './dto/consultations-query.dto.js';
import {
  evolutionQuerySchema,
  repartitionQuerySchema,
} from './dto/query-schema.dto.js';

function parseQuery<T>(schema: ZodType<T>, query: unknown): T {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw new BadRequestException(
      result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    );
  }
  return result.data;
}

@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('kpis')
  async getKpis() {
    return this.analyticsService.getKpis();
  }

  @Get('charts')
  async getCharts() {
    return this.analyticsService.getCharts();
  }

  @Get('charts/evolution')
  async getEvolution(@Query() query: unknown) {
    return this.analyticsService.getEvolution(parseQuery(evolutionQuerySchema, query));
  }

  @Get('charts/repartition')
  async getRepartition(@Query() query: unknown) {
    return this.analyticsService.getRepartition(parseQuery(repartitionQuerySchema, query));
  }

  @Get('consultations')
  async getConsultationsStats(@Query() query: ConsultationsQueryDto) {
    return this.analyticsService.getConsultationsStats(query);
  }
}