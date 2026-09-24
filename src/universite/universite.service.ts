import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUniversiteDto } from './dto/create-universite.dto.js';

@Injectable()
export class UniversiteService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUniversiteDto: CreateUniversiteDto) {
    const existing = await this.prisma.universite.findUnique({
      where: { nom: createUniversiteDto.nom },
    });

    if (existing) {
      throw new ConflictException('Cette université existe déjà');
    }

    return this.prisma.universite.create({
      data: createUniversiteDto,
    });
  }

  async findAll() {
    return this.prisma.universite.findMany({
      orderBy: { nom: 'asc' },
    });
  }
}
