import { TypeDiplome } from '../generated/prisma/client.js';

interface MemoireBib {
  id: string;
  titre: string;
  resume?: string | null;
  anneeSoutenance: number;
  typeDiplome: TypeDiplome;
  auteurNom: string;
  auteurPrenom: string;
  pdfUrl?: string | null;
  universite?: { nom: string } | null;
  domaine?: { nom: string } | null;
  motsCles: { motCle: { libelle: string } }[];
  encadreurs: { encadreur: { nom: string; prenom: string; titre?: string | null } }[];
}

/** Échappe les caractères spéciaux BibTeX (l'UTF-8 est conservé tel quel) */
const esc = (s: string) =>
  s
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/\s+/g, ' ')
    .trim();

const ascii = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '');

export function buildBibtexKey(m: Pick<MemoireBib, 'auteurNom' | 'anneeSoutenance' | 'titre'>) {
  const mot = m.titre.split(/\s+/).map(ascii).find((w) => w.length > 3) ?? 'memoire';
  return `${ascii(m.auteurNom).toLowerCase()}${m.anneeSoutenance}${mot.toLowerCase()}`;
}

export function buildBibtex(m: MemoireBib): string {
  // BibTeX n'a pas de type "licence" : on utilise @mastersthesis + champ `type`
  const entryType = m.typeDiplome === 'DOCTORAT' ? 'phdthesis' : 'mastersthesis';
  const typeLabel = {
    LICENCE: 'Mémoire de licence',
    MASTER: 'Mémoire de master',
    DOCTORAT: 'Thèse de doctorat',
  }[m.typeDiplome];

  const fields: [string, string | undefined][] = [
    ['author', `${esc(m.auteurNom)}, ${esc(m.auteurPrenom)}`],
    ['title', `{${esc(m.titre)}}`],
    ['school', m.universite ? esc(m.universite.nom) : undefined],
    ['year', String(m.anneeSoutenance)],
    ['type', typeLabel],
    [
      'advisor',
      m.encadreurs.length
        ? m.encadreurs.map(({ encadreur: e }) => `${esc(e.nom)}, ${esc(e.prenom)}`).join(' and ')
        : undefined,
    ],
    ['keywords', m.motsCles.length ? m.motsCles.map((k) => esc(k.motCle.libelle)).join(', ') : undefined],
    ['abstract', m.resume ? esc(m.resume) : undefined],
    ['url', m.pdfUrl ?? undefined],
  ];

  const body = fields
    .filter(([, v]) => v)
    .map(([k, v]) => `  ${k.padEnd(8)} = {${v}}`)
    .join(',\n');

  return `@${entryType}{${buildBibtexKey(m)},\n${body}\n}\n`;
}