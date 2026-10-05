import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MemoryCacheService } from '../common/memory.cache.service.js';
import { StatutMemoire } from '@prisma/client';

export interface TrendingItem {
  motCleId: string;
  libelle: string;
  count: number;
}

const CACHE_KEY_PREFIX = 'trending:limit:';
/* TTL par défaut : 5 minutes */
const DEFAULT_TTL_SECONDS = 300;

@Injectable()
export class MotCleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: MemoryCacheService,
  ) {}

  async getTrending(limit: number) {
    const cacheKey = `${CACHE_KEY_PREFIX}${limit}`;

    const cached = this.cache.get<TrendingItem[]>(cacheKey);
    if (cached) return cached;

    const grouped = await this.prisma.memoireMotCle.groupBy({
      by: ['motCleId'],
      where: {
        memoire: { statut: StatutMemoire.VALIDE },
      },
      _count: { motCleId: true },
      orderBy: { _count: { motCleId: 'desc' } },
      take: limit,
    });

    if (grouped.length === 0) {
      this.cache.set(cacheKey, [], DEFAULT_TTL_SECONDS);
      return [];
    }

    const motCleIds = grouped.map((r) => r.motCleId);
    const motCles = await this.prisma.motCle.findMany({
      where: { id: { in: motCleIds } },
      select: { id: true, libelle: true },
    });

    const libelleMap = new Map(motCles.map((m) => [m.id, m.libelle]));

    const result: TrendingItem[] = grouped.map((r) => ({
      motCleId: r.motCleId,
      libelle: libelleMap.get(r.motCleId) ?? '',
      count: r._count.motCleId,
    }));

    this.cache.set(cacheKey, result, DEFAULT_TTL_SECONDS);

    return result;
  }
}
