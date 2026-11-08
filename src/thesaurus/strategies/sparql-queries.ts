import type { SearchMode } from '../thesaurus.types.js';
import type { ThesaurusId } from '../thesaurus.schemas.js';

/**
 * Contrat : chaque requête projette ?concept (URI), ?prefLabel (descripteur préconisé)
 * et ?matched (libellé qui a matché : prefLabel ou synonyme).
 */
export type SparqlQueryBuilder = (input: { term: string; mode: SearchMode; lang: string }) => string;

const LIMIT = 20;

/** Échappe une valeur injectée dans un littéral SPARQL "..." */
const lit = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n\t]+/g, ' ');

function labelFilter(variable: string, term: string, mode: SearchMode): string {
  const v = lit(term.toLowerCase());
  return mode === 'exact'
    ? `FILTER(LCASE(STR(${variable})) = "${v}")`
    : `FILTER(STRSTARTS(LCASE(STR(${variable})), "${v}"))`;
}

/** Requête Lucene (luc:term de Getty) : tous les mots requis, préfixe sur le dernier en mode `prefix`. */
function lucene(term: string, mode: SearchMode): string {
  const words = term
    .split(/\s+/)
    .map((w) => w.replace(/[+\-!(){}[\]^~:/&|]/g, ''))
    .filter(Boolean);
  return words.map((w, i) => (mode === 'prefix' && i === words.length - 1 ? `${w}*` : w)).join(' AND ');
}

/** Eurovoc — Cellar (Publications Office de l'UE). 100141 = concept scheme EuroVoc. */
const eurovoc: SparqlQueryBuilder = ({ term, mode, lang }) => `
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT DISTINCT ?concept ?prefLabel ?matched
WHERE {
  ?concept a skos:Concept ;
           skos:inScheme <http://eurovoc.europa.eu/100141> ;
           skos:prefLabel ?prefLabel .
  FILTER(LANG(?prefLabel) = "${lit(lang)}")
  { ?concept skos:prefLabel ?matched } UNION { ?concept skos:altLabel ?matched }
  FILTER(LANG(?matched) = "${lit(lang)}")
  ${labelFilter('?matched', term, mode)}
}
LIMIT ${LIMIT}`;

/** RAMEAU — data.bnf.fr. r166 = vedettes « nom commun » (évite noms de personnes / collectivités). */
const rameau: SparqlQueryBuilder = ({ term, mode }) => `
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX dcterms: <http://purl.org/dc/terms/>
SELECT DISTINCT ?concept ?prefLabel ?matched
WHERE {
  ?concept a skos:Concept ;
           dcterms:isPartOf <http://data.bnf.fr/vocabulary/rameau/r166> ;
           skos:prefLabel ?prefLabel .
  { ?concept skos:prefLabel ?matched } UNION { ?concept skos:altLabel ?matched }
  ${labelFilter('?matched', term, mode)}
}
LIMIT ${LIMIT}`;

/** Getty AAT — préfixes obligatoires ; recherche plein-texte Lucene puis filtre sur le libellé dans la langue demandée. */
const gettyAat: SparqlQueryBuilder = ({ term, mode, lang }) => `
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX xl: <http://www.w3.org/2008/05/skos-xl#>
PREFIX luc: <http://www.ontotext.com/owlim/lucene#>
PREFIX aat: <http://vocab.getty.edu/aat/>
SELECT DISTINCT ?concept ?prefLabel ?matched
WHERE {
  ?concept luc:term "${lit(lucene(term, mode))}" ;
           a skos:Concept ;
           skos:inScheme aat: .
  ?concept xl:prefLabel/xl:literalForm ?prefLabel .
  FILTER(LANG(?prefLabel) = "${lit(lang)}")
  { ?concept xl:prefLabel/xl:literalForm ?matched } UNION { ?concept xl:altLabel/xl:literalForm ?matched }
  FILTER(LANG(?matched) = "${lit(lang)}")
  ${labelFilter('?matched', term, mode)}
}
LIMIT ${LIMIT}`;

export const SPARQL_QUERY_BUILDERS: Partial<Record<ThesaurusId, SparqlQueryBuilder>> = {
  EUROVOC: eurovoc,
  RAMEAU: rameau,
  GETTY_AAT: gettyAat,
};
