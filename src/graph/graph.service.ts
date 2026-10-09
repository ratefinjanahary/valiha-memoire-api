import { Injectable } from '@nestjs/common';
import { StatutMemoire } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export type GraphNodeType = 'universite' | 'domaine' | 'encadreur' | 'memoire';
export type GraphEdgeType = 'appartient_a' | 'traite_de' | 'encadre_par' | 'auteur_de';

export interface GraphNode {
  id: string; // préfixé : univ_ / dom_ / enc_ / mem_
  label: string;
  type: GraphNodeType;
  data: Record<string, unknown>; // contient toujours refId (id réel en BD)
}

export interface GraphEdge {
  id: string; // unique, requis par React Flow
  source: string;
  target: string;
  type: GraphEdgeType;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

@Injectable()
export class GraphService {
  constructor(private readonly prisma: PrismaService) {}

  async getGraphData(): Promise<GraphData> {
    const [memoires, universites, domaines, encadreurs] = await Promise.all([
      this.prisma.memoire.findMany({
        where: { statut: StatutMemoire.VALIDE },
        select: {
          id: true,
          titre: true,
          anneeSoutenance: true,
          typeDiplome: true,
          auteurNom: true,
          auteurPrenom: true,
          universiteId: true,
          domaineId: true,
          auteurEncadreurId: true,
          encadreurs: { select: { encadreurId: true, role: true } },
        },
      }),
      this.prisma.universite.findMany({ select: { id: true, nom: true, sigle: true } }),
      this.prisma.domaine.findMany({ select: { id: true, nom: true } }),
      this.prisma.encadreur.findMany({ select: { id: true, nom: true, prenom: true, titre: true } }),
    ]);

    const edges: GraphEdge[] = [];
    const memoireNodes: GraphNode[] = [];

    // On ne garde que les noeuds réellement reliés à un mémoire VALIDE (pas d'orphelins dans le graphe)
    const usedUniv = new Set<string>();
    const usedDom = new Set<string>();
    const usedEnc = new Set<string>();

    const addEdge = (source: string, target: string, type: GraphEdgeType) => {
      edges.push({ id: `${type}:${source}:${target}`, source, target, type });
    };

    for (const m of memoires) {
      const memId = `mem_${m.id}`;

      memoireNodes.push({
        id: memId,
        label: m.titre,
        type: 'memoire',
        data: {
          refId: m.id,
          anneeSoutenance: m.anneeSoutenance,
          typeDiplome: m.typeDiplome,
          auteur: `${m.auteurPrenom} ${m.auteurNom}`,
        },
      });

      usedUniv.add(m.universiteId);
      addEdge(memId, `univ_${m.universiteId}`, 'appartient_a');

      usedDom.add(m.domaineId);
      addEdge(memId, `dom_${m.domaineId}`, 'traite_de');

      for (const me of m.encadreurs) {
        usedEnc.add(me.encadreurId);
        addEdge(memId, `enc_${me.encadreurId}`, 'encadre_par');
      }

      // L'auteur du mémoire est lui-même un encadreur enregistré → lignée académique
      if (m.auteurEncadreurId) {
        usedEnc.add(m.auteurEncadreurId);
        addEdge(`enc_${m.auteurEncadreurId}`, memId, 'auteur_de');
      }
    }

    const nodes: GraphNode[] = [
      ...universites
        .filter((u) => usedUniv.has(u.id))
        .map<GraphNode>((u) => ({
          id: `univ_${u.id}`,
          label: u.sigle || u.nom,
          type: 'universite',
          data: { refId: u.id, nom: u.nom },
        })),
      ...domaines
        .filter((d) => usedDom.has(d.id))
        .map<GraphNode>((d) => ({
          id: `dom_${d.id}`,
          label: d.nom,
          type: 'domaine',
          data: { refId: d.id },
        })),
      ...encadreurs
        .filter((e) => usedEnc.has(e.id))
        .map<GraphNode>((e) => ({
          id: `enc_${e.id}`,
          label: `${e.nom} ${e.prenom}`,
          type: 'encadreur',
          data: { refId: e.id, titre: e.titre },
        })),
      ...memoireNodes,
    ];

    return { nodes, edges };
  }
}