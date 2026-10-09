import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateEncadreurDto } from './dto/create-encadreur.dto.js';
import { SearchEncadreurDto } from './dto/search-encadreur.dto.js';

@Injectable()
export class EncadreurService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEncadreurDto) {
    if (dto.email) {
      const existing = await this.prisma.encadreur.findFirst({
        where: { email: { equals: dto.email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException('Un encadreur avec cet email existe déjà');
      }
    }

    return this.prisma.encadreur.create({
      data: {
        nom: dto.nom,
        prenom: dto.prenom,
        titre: dto.titre ?? null,
        email: dto.email ?? null,
      },
      select: { id: true, nom: true, prenom: true, titre: true, email: true, createdAt: true },
    });
  }

  /**
   * Liste paginée + recherche, pensée pour un ComboBox.
   * Chaque mot de `q` doit matcher nom, prénom ou titre ("rakoto jean" trouve Jean Rakoto).
   * L'email n'est volontairement pas renvoyé.
   */
  async search(dto: SearchEncadreurDto) {
    const { q, page, limit } = dto;
    const skip = (page - 1) * limit;
    const mots = q?.split(/\s+/).filter(Boolean) ?? [];

    const where: Prisma.EncadreurWhereInput = mots.length
      ? {
          AND: mots.map((mot) => ({
            OR: [
              { nom: { contains: mot, mode: 'insensitive' } },
              { prenom: { contains: mot, mode: 'insensitive' } },
              { titre: { contains: mot, mode: 'insensitive' } },
            ],
          })),
        }
      : {};

    const [total, rows] = await Promise.all([
      this.prisma.encadreur.count({ where }),
      this.prisma.encadreur.findMany({
        where,
        select: {
          id: true,
          nom: true,
          prenom: true,
          titre: true,
          _count: { select: { memoires: true, memoiresAuteur: true } },
        },
        orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    const data = rows.map(({ _count, ...e }) => ({
      ...e,
      nbMemoiresEncadres: _count.memoires,
      nbMemoiresAuteur: _count.memoiresAuteur,
    }));

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
