import { normalize } from './thesaurus.matcher.js';
import {
  DomainChainSchema,
  ThesaurusConfigSchema,
  type ThesaurusConfig,
  type ThesaurusId,
} from './thesaurus.schemas.js';

/* ═════════════════════ 1. Endpoints ═════════════════════ */

const stripSlash = (u: string) => u.replace(/\/+$/, '');

/**
 * Construit et VALIDE (Zod) la config au démarrage : une URL ou un timeout invalide
 * fait échouer le boot avec un message clair plutôt qu'une erreur obscure à la première soumission.
 * Surcharges : THESAURUS_<ID>_URL, THESAURUS_<ID>_VOCAB_ID (Skosmos), THESAURUS_<ID>_TIMEOUT_MS, THESAURUS_LANG.
 * Les anciennes variables UNESCO_* restent prises en compte.
 */
export function buildThesaurusConfig(env: NodeJS.ProcessEnv = process.env): ThesaurusConfig {
  const lang = env.THESAURUS_LANG ?? env.UNESCO_LANG ?? 'fr';
  const url = (id: ThesaurusId, fallback: string, legacy?: string) =>
    stripSlash(env[`THESAURUS_${id}_URL`] ?? legacy ?? fallback);
  const timeout = (id: ThesaurusId, fallback: number, legacy?: string) =>
    Number(env[`THESAURUS_${id}_TIMEOUT_MS`] ?? legacy ?? fallback);
  const vocab = (id: ThesaurusId, fallback: string, legacy?: string) =>
    env[`THESAURUS_${id}_VOCAB_ID`] ?? legacy ?? fallback;

  const SKOSMOS_TIMEOUT = 3000;
  const SPARQL_TIMEOUT = 6000; // les endpoints SPARQL publics sont plus lents

  return ThesaurusConfigSchema.parse({
    UNESCO: {
      kind: 'skosmos',
      baseUrl: url('UNESCO', 'https://vocabularies.unesco.org/rest/v1', env.UNESCO_API_BASE_URL),
      vocabId: vocab('UNESCO', 'unesco', env.UNESCO_VOCAB_ID),
      lang,
      timeoutMs: timeout('UNESCO', SKOSMOS_TIMEOUT, env.UNESCO_TIMEOUT_MS),
    },
    AGROVOC: {
      kind: 'skosmos',
      baseUrl: url('AGROVOC', 'https://agrovoc.fao.org/browse/rest/v1'),
      vocabId: vocab('AGROVOC', 'agrovoc'),
      lang,
      timeoutMs: timeout('AGROVOC', SKOSMOS_TIMEOUT),
    },
    /** MeSH bilingue Inserm converti en SKOS par Inist-CNRS : vocabulaire Loterre « JVR » */
    MESH: {
      kind: 'skosmos',
      baseUrl: url('MESH', 'https://loterre.istex.fr/rest/v1'),
      vocabId: vocab('MESH', 'JVR'),
      lang,
      timeoutMs: timeout('MESH', SKOSMOS_TIMEOUT),
    },
    EUROVOC: {
      kind: 'sparql',
      endpointUrl: url('EUROVOC', 'https://publications.europa.eu/webapi/rdf/sparql'),
      lang,
      timeoutMs: timeout('EUROVOC', SPARQL_TIMEOUT),
    },
    RAMEAU: {
      kind: 'sparql',
      endpointUrl: url('RAMEAU', 'https://data.bnf.fr/sparql'),
      lang,
      timeoutMs: timeout('RAMEAU', SPARQL_TIMEOUT),
    },
    GETTY_AAT: {
      kind: 'sparql',
      endpointUrl: url('GETTY_AAT', 'https://vocab.getty.edu/sparql.json'),
      lang,
      timeoutMs: timeout('GETTY_AAT', SPARQL_TIMEOUT),
    },
  });
}

/* ═════════════════════ 2. Routage Domaine → chaîne de thésaurus ═════════════════════ */

/** Thésaurus généraliste ajouté en dernier recours à toute chaîne. */
export const UNIVERSAL_FALLBACK: ThesaurusId = 'UNESCO';

/**
 * Domaines connus (noms exacts de la table `domaines`). Ordre = priorité.
 * UNESCO est toujours ajouté à la fin s'il n'y est pas déjà.
 */
const EXPLICIT_ROUTES: ReadonlyArray<readonly [domaine: string, chain: readonly ThesaurusId[]]> = [
  ['Informatique et Numérique', ['UNESCO']],
  ["Gestion, Commerce et Administration d'Entreprise", ['EUROVOC']],
  ["Génie Civil et Sciences de l'Ingénieur", ['UNESCO', 'GETTY_AAT']],
  ['Sciences Fondamentales et Appliquées', ['UNESCO']],
  ['Sciences de la Santé et Biomédicales', ['MESH']],
  ['Droit, Sciences Politiques et Économiques', ['EUROVOC']],
  ['Sciences Humaines et Sociales', ['UNESCO', 'RAMEAU']],
  ['Lettres, Langues et Communication', ['RAMEAU']],
  ['Agriculture, Élevage et Environnement', ['AGROVOC']],
  ['Éducation et Formation Pédagogique', ['UNESCO']],
];

/** Domaines futurs / renommés : règles par mots-clés sur le nom normalisé (sans accents, minuscules). Premier match gagne. */
const FALLBACK_RULES: ReadonlyArray<{ pattern: RegExp; chain: readonly ThesaurusId[] }> = [
  { pattern: /sante|medecine|biomedic|pharmac|infirm/, chain: ['MESH'] },
  { pattern: /droit|politique|econom|gestion|commerce|finance|administration/, chain: ['EUROVOC'] },
  { pattern: /agricultur|agronom|elevage|environnement|peche|foret|alimentation/, chain: ['AGROVOC'] },
  { pattern: /architecture|archeolog|patrimoine|beaux arts|\barts?\b/, chain: ['GETTY_AAT', 'RAMEAU'] },
  { pattern: /litterature|lettres|histoire|langue|philosophie|theologie/, chain: ['RAMEAU'] },
];

/** Table indexée par nom normalisé ; chaque chaîne est validée par Zod au chargement du module (faute de frappe → boot KO). */
const ROUTES: ReadonlyMap<string, readonly ThesaurusId[]> = new Map(
  EXPLICIT_ROUTES.map(([domaine, chain]) => [normalize(domaine), DomainChainSchema.parse(chain)] as const),
);

export function resolveThesaurusChain(domaineNom?: string | null): ThesaurusId[] {
  const key = domaineNom ? normalize(domaineNom) : '';
  const base = ROUTES.get(key) ?? FALLBACK_RULES.find((r) => r.pattern.test(key))?.chain ?? [];
  return [...new Set<ThesaurusId>([...base, UNIVERSAL_FALLBACK])];
}

/** Nom du thésaurus tel qu'on le donne au LLM pour orienter la formulation des candidats. */
export const THESAURUS_DISPLAY_NAMES: Record<ThesaurusId, string> = {
  UNESCO: "de l'UNESCO",
  EUROVOC: 'EuroVoc (Union européenne)',
  RAMEAU: 'RAMEAU (BnF)',
  AGROVOC: 'AGROVOC (FAO)',
  MESH: 'MeSH (médecine)',
  GETTY_AAT: 'Art & Architecture Thesaurus (Getty)',
};