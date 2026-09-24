import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { DomaineService } from './domaine.service.js';
import { CreateDomaineDto } from './dto/create-domaine.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('api/domaine')
export class DomaineController {
  constructor(private readonly domaineService: DomaineService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createDomaineDto: CreateDomaineDto) {
    return this.domaineService.create(createDomaineDto);
  }

  @Get()
  findAll() {
    return this.domaineService.findAll();
  }
}
