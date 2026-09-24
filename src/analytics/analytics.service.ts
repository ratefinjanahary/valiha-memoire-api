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
}
