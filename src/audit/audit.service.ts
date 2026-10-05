import { Injectable, Logger } from '@nestjs/common';
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
    const limit = 10;
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
}
