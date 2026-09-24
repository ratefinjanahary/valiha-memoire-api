import { Injectable, ConflictException } from '@nestjs/common';
import { CreateDomaineDto } from './dto/create-domaine.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DomaineService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDomaineDto: CreateDomaineDto) {
    const existing = await this.prisma.domaine.findUnique({
      where: { nom: createDomaineDto.nom },
    });

    if (existing) {
      throw new ConflictException('Ce domaine existe déjà');
    }

    return this.prisma.domaine.create({
      data: createDomaineDto,
    });
  }

  async findAll() {
    return this.prisma.domaine.findMany({
      orderBy: { nom: 'asc' },
    });
  }
}
