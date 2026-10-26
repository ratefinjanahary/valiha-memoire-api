import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';

const NB_ANNEES = 5;
const MAX_UNIVERSITES = 5;

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getKpis() {
    const totalMemoires = await this.prisma.memoire.count({
      where: { statut: 'VALIDE' }
    });
    
    const enAttente = await this.prisma.memoire.count({
      where: { statut: 'EN_ATTENTE_MODERATION' }
    });
    
    const rejetes = await this.prisma.memoire.count({
      where: { statut: 'REJETTE' }
    });

    const totalConsultations = await this.prisma.consultation.count();

    return { totalMemoires, enAttente, rejetes, totalConsultations };
  }

  /**
   * Charge tout d'un coup pour l'affichage initial :
   * - évolution : dernière fenêtre de 5 ans
   * - répartition : top 5 universités
   * - options : universités sélectionnables + bornes des années
   */
  async getCharts() {
    const [options, evolution, repartitionUniversite] = await Promise.all([
      this.getChartsOptions(),
      this.getEvolution({}),
      this.getRepartition({}),
    ]);

    return {
      repartitionUniversite,
      evolutionAnnee: evolution.data,
      periode: { anneeDebut: evolution.anneeDebut, anneeFin: evolution.anneeFin },
      options,
    };
  }

  /** Universités ayant au moins un mémoire validé + bornes des années de soutenance. */
  async getChartsOptions() {
    const [grouped, universites, bornes] = await Promise.all([
      this.prisma.memoire.groupBy({
        by: ['universiteId'],
        _count: { id: true },
        where: { statut: 'VALIDE' },
      }),
      this.prisma.universite.findMany({
        select: { id: true, nom: true, sigle: true },
      }),
      this.prisma.memoire.aggregate({
        _min: { anneeSoutenance: true },
        _max: { anneeSoutenance: true },
        where: { statut: 'VALIDE' },
      }),
    ]);

    const totaux = new Map<string, number>(
      grouped.map((g: any) => [g.universiteId, g._count.id] as [string, number]),
    );

    const listeUniversites = universites
      .map((u) => ({
        id: u.id,
        label: u.sigle || u.nom,
        total: totaux.get(u.id) ?? 0,
      }))
      .filter((u) => u.total > 0)
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));

    return {
      universites: listeUniversites,
      anneeMin: bornes._min.anneeSoutenance ?? null,
      anneeMax: bornes._max.anneeSoutenance ?? null,
    };
  }

  /**
   * Mémoires validés par année de soutenance sur une fenêtre de 5 ans.
   * Les années sans mémoire sont renvoyées avec count = 0.
   * Sans `anneeDebut` : les 5 dernières années contenant des données.
   */
  async getEvolution(query: { anneeDebut?: number }) {
    let anneeDebut = query.anneeDebut;

    if (anneeDebut === undefined) {
      const { _max } = await this.prisma.memoire.aggregate({
        _max: { anneeSoutenance: true },
        where: { statut: 'VALIDE' },
      });
      const derniere = _max.anneeSoutenance ?? new Date().getUTCFullYear();
      anneeDebut = derniere - (NB_ANNEES - 1);
    }

    const anneeFin = anneeDebut + NB_ANNEES - 1;

    const raw = await this.prisma.memoire.groupBy({
      by: ['anneeSoutenance'],
      _count: { id: true },
      where: {
        statut: 'VALIDE',
        anneeSoutenance: { gte: anneeDebut, lte: anneeFin },
      },
    });

    const counts = new Map<number, number>(
      raw.map((r: any) => [r.anneeSoutenance, r._count.id] as [number, number]),
    );

    const data = Array.from({ length: NB_ANNEES }, (_, i) => {
      const annee = anneeDebut! + i;
      return { annee, count: counts.get(annee) ?? 0 };
    });

    return { anneeDebut, anneeFin, data };
  }

  /**
   * Répartition des mémoires validés par université (5 max).
   * Sans `universiteIds` : les 5 universités avec le plus de mémoires.
   */
  async getRepartition(query: { universiteIds?: string[] }) {
    const ids = [...new Set(query.universiteIds ?? [])].slice(0, MAX_UNIVERSITES);

    const where: Prisma.MemoireWhereInput = { statut: 'VALIDE' };
    if (ids.length > 0) {
      where.universiteId = { in: ids };
    }

    const raw = await this.prisma.memoire.groupBy({
      by: ['universiteId'],
      _count: { id: true },
      where,
      orderBy: { _count: { id: 'desc' } },
      take: MAX_UNIVERSITES,
    });

    const universites = await this.prisma.universite.findMany({
      where: { id: { in: raw.map((r: any) => r.universiteId) } },
      select: { id: true, nom: true, sigle: true },
    });

    return raw.map((item: any) => {
      const univ = universites.find((u) => u.id === item.universiteId);
      return {
        id: item.universiteId as string,
        label: univ?.sigle || univ?.nom || 'Inconnu',
        value: item._count.id as number,
      };
    });
  }

  async getConsultationsStats(query: { annee?: number; mois?: number }) {
    const { annee, mois } = query;
    const where: Prisma.ConsultationWhereInput = {};

    if (annee || mois) {
      const year = annee ?? new Date().getUTCFullYear();

      const startDate = mois
        ? new Date(Date.UTC(year, mois - 1, 1))
        : new Date(Date.UTC(year, 0, 1));

      const endDate = mois
        ? new Date(Date.UTC(year, mois, 1))
        : new Date(Date.UTC(year + 1, 0, 1));

      where.consultedAt = { gte: startDate, lt: endDate };
    }

    const totalConsultations = await this.prisma.consultation.count({ where });

    return {
      annee: annee ?? null,
      mois: mois ?? null,
      totalConsultations,
    };
  }
}