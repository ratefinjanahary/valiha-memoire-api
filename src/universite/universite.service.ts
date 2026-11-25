import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUniversiteDto } from './dto/create-universite.dto.js';
import { FindUniversitesQueryDto } from './dto/find-universites-query.dto.js';

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

  // page, limit et q sont déjà validés, convertis et normalisés (défauts, trim) par Zod
  async findAll({ page, limit, q }: FindUniversitesQueryDto) {
    const where = q
      ? {
          OR: [
            { nom: { contains: q, mode: 'insensitive' as const } },
            { sigle: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await this.prisma.$transaction([
      this.prisma.universite.findMany({
        where,
        // `id` en second critère : tri stable, pas de doublon/trou entre deux pages
        orderBy: [{ nom: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.universite.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}