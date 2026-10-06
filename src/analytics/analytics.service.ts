import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Universite } from '@prisma/client';

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

    return {
      totalMemoires,
      enAttente,
      rejetes,
      totalConsultations
    };
  }

  async getCharts() {
    // Répartition par université
    const parUniversiteRaw = await this.prisma.memoire.groupBy({
      by: ['universiteId'],
      _count: { id: true },
      where: { statut: 'VALIDE' }
    });

    const universites = await this.prisma.universite.findMany();
    const parUniversite = parUniversiteRaw.map((item: any) => {
      const univ = universites.find((u: Universite) => u.id === item.universiteId);
      return {
        label: univ?.sigle || univ?.nom || 'Inconnu',
        value: item._count.id
      };
    });

    // Évolution par année
    const evolutionAnneeRaw = await this.prisma.memoire.groupBy({
      by: ['anneeSoutenance'],
      _count: { id: true },
      where: { statut: 'VALIDE' },
      orderBy: { anneeSoutenance: 'asc' }
    });

    const evolutionAnnee = evolutionAnneeRaw.map((item: any) => ({
      annee: item.anneeSoutenance,
      count: item._count.id
    }));

    return {
      repartitionUniversite: parUniversite,
      evolutionAnnee: evolutionAnnee
    };
  }

  async getConsultationsStats(query: { annee?: number; mois?: number }) {
    const { annee, mois } = query;
    const where: any = {};

    if (annee || mois) {
      const year = annee || new Date().getFullYear();
      let startDate: Date;
      let endDate: Date;

      if (mois) {
        // Filtrer sur un mois précis d'une année donnée (les mois sont de 0 à 11 en JS)
        startDate = new Date(year, mois - 1, 1, 0, 0, 0, 0);
        endDate = new Date(year, mois, 0, 23, 59, 59, 999);
      } else {
        // Filtrer sur toute l'année
        startDate = new Date(year, 0, 1, 0, 0, 0, 0);
        endDate = new Date(year, 11, 31, 23, 59, 59, 999);
      }

      where.consultedAt = {
        gte: startDate,
        lte: endDate,
      };
    }

    const count = await this.prisma.consultation.count({ where });

    return {
      annee: annee || null,
      mois: mois || null,
      totalConsultations: count,
    };
  }
}
