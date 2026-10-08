import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Domaine, Encadreur, Universite, Memoire } from '@prisma/client';

@Injectable()
export class GraphService {
  constructor(private prisma: PrismaService) {}

  async getGraphData() {
    const universites = await this.prisma.universite.findMany();
    const domaines = await this.prisma.domaine.findMany();
    const encadreurs = await this.prisma.encadreur.findMany();
    const memoires = await this.prisma.memoire.findMany({
      where: { statut: 'VALIDE' },
      include: { encadreurs: true, motsCles: true }
    });

    const nodes: any[] = [];
    const edges: any[] = [];

    /* Ajouter les noeuds universités */
    universites.forEach((u: Universite) => {
      nodes.push({ id: `univ_${u.id}`, label: u.sigle || u.nom, type: 'universite' });
    });

    /* Idem */
    domaines.forEach((d: Domaine) => {
      nodes.push({ id: `dom_${d.id}`, label: d.nom, type: 'domaine' });
    });

    encadreurs.forEach((e: Encadreur) => {
      nodes.push({ id: `enc_${e.id}`, label: `${e.nom} ${e.prenom}`, type: 'encadreur' });
    });

    // Ajouter les noeuds mémoires et les liens
    memoires.forEach((m: any) => {
      const memId = `mem_${m.id}`;
      nodes.push({ id: memId, label: m.titre, type: 'memoire' });

      // Lien vers l'université
      edges.push({ source: memId, target: `univ_${m.universiteId}`, type: 'appartient_a' });
      // Lien vers le domaine
      edges.push({ source: memId, target: `dom_${m.domaineId}`, type: 'traite_de' });
      
      // Liens vers les encadreurs
      m.encadreurs.forEach((me: any) => {
        edges.push({ source: memId, target: `enc_${me.encadreurId}`, type: 'encadre_par' });
      });
    });

    return { nodes, edges };
  }
}
