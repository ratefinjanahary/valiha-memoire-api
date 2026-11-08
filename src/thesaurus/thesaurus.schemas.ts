import { z } from 'zod';

/* ───────────────── Identifiants (alignés sur l'enum Prisma `Thesaurus`) ───────────────── */

export const THESAURUS_IDS = ['UNESCO', 'EUROVOC', 'RAMEAU', 'AGROVOC', 'MESH', 'GETTY_AAT'] as const;
export const ThesaurusIdSchema = z.enum(THESAURUS_IDS);
export type ThesaurusId = z.infer<typeof ThesaurusIdSchema>;

/* ───────────────── Réponses externes : validation défensive ───────────────── */

/** Skosmos (UNESCO, AGROVOC, Loterre/MeSH) : GET {base}/search */
export const SkosResultSchema = z.object({
  uri: z.string().min(1),
  type: z.array(z.string()).optional(),
  prefLabel: z.string().min(1),
  altLabel: z.string().optional(),
  hiddenLabel: z.string().optional(),
});
export type SkosResult = z.infer<typeof SkosResultSchema>;
export const SkosEnvelopeSchema = z.object({ results: z.array(z.unknown()).default([]) });

/** SPARQL 1.1 Query Results JSON (Eurovoc/Cellar, data.bnf.fr, Getty) */
const SparqlTermSchema = z.object({
  type: z.string(),
  value: z.string(),
  'xml:lang': z.string().optional(),
});
export const SparqlJsonSchema = z.object({
  results: z.object({
    bindings: z.array(z.record(z.string(), SparqlTermSchema)),
  }),
});

/* ───────────────── Configuration des endpoints (validée au démarrage) ───────────────── */

const CommonEndpointSchema = z.object({
  lang: z.string().min(2).max(8),
  timeoutMs: z.number().int().min(500).max(30_000),
});

export const SkosmosEndpointSchema = CommonEndpointSchema.extend({
  kind: z.literal('skosmos'),
  baseUrl: z.url(),
  /** Identifiant Skosmos du vocabulaire (≠ de l'espace de noms des URI) */
  vocabId: z.string().min(1),
});

export const SparqlEndpointSchema = CommonEndpointSchema.extend({
  kind: z.literal('sparql'),
  endpointUrl: z.url(),
});

export const ThesaurusEndpointSchema = z.discriminatedUnion('kind', [SkosmosEndpointSchema, SparqlEndpointSchema]);
export type SkosmosEndpoint = z.infer<typeof SkosmosEndpointSchema>;
export type SparqlEndpoint = z.infer<typeof SparqlEndpointSchema>;

/** Exhaustif : un endpoint par thésaurus, sinon le démarrage échoue avec un message clair. */
export const ThesaurusConfigSchema = z.record(ThesaurusIdSchema, ThesaurusEndpointSchema);
export type ThesaurusConfig = z.infer<typeof ThesaurusConfigSchema>;

/* ───────────────── Table de routage Domaine → chaîne de thésaurus ───────────────── */

export const DomainChainSchema = z
  .array(ThesaurusIdSchema)
  .min(1)
  .refine((chain) => new Set(chain).size === chain.length, { message: 'Chaîne de thésaurus avec doublons' });
