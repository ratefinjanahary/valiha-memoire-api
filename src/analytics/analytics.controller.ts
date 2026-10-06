import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../auth/role.enum.js';
import { ConsultationsQueryDto } from './dto/consultations-query.dto.js';

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

  @Get('consultations')
  async getConsultationsStats(@Query() query: ConsultationsQueryDto) {
    return this.analyticsService.getConsultationsStats(query);
  }
}
