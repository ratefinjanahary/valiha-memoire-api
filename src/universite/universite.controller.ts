import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { UniversiteService } from './universite.service.js';
import { CreateUniversiteDto } from './dto/create-universite.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('api/universites')
export class UniversiteController {
  constructor(private readonly universiteService: UniversiteService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createUniversiteDto: CreateUniversiteDto) {
    return this.universiteService.create(createUniversiteDto);
  }

  @Get()
  findAll() {
    return this.universiteService.findAll();
  }
}
