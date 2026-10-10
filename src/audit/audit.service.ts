import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditAction } from '../common/audit.actions.js';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enregistre une action auditée de façon asynchrone (fire-and-forget).
   * Ne bloque jamais l'appelant. Les erreurs sont loggées, pas propagées.
   */
  log(action: AuditAction, userId?: string, details?: string): void {
    this.prisma.auditLog.create({
      data: {
        action,
        userId: userId ?? null,
        details: details ?? null,
      },
    })
    .catch((err: unknown) =>
      this.logger.error(`AuditLog failed [${action}]`, err),
    );
  }

  async findAll(page: number = 1) {
    const limit = 5;
    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: { nom: true, prenom: true, email: true, role: true },
          },
        },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** Supprime une entrée du journal. La suppression elle-même est tracée. */
  async remove(id: string, actorId?: string) {
    // deleteMany plutôt que delete : pas d'exception P2025, on gère le 404 nous-mêmes
    const { count } = await this.prisma.auditLog.deleteMany({ where: { id } });
    if (count === 0) {
      throw new NotFoundException("Entrée du journal d'audit introuvable");
    }

    this.log(AuditAction.AUDIT_LOG_DELETED, actorId, `1 entrée supprimée (${id})`);
    return { deleted: count };
  }

  /** Supprime plusieurs entrées d'un coup (sélection du tableau). */
  async removeMany(ids: string[], actorId?: string) {
    const { count } = await this.prisma.auditLog.deleteMany({
      where: { id: { in: ids } },
    });

    this.log(AuditAction.AUDIT_LOG_DELETED, actorId, `${count} entrée(s) supprimée(s)`);
    return { deleted: count };
  }
}