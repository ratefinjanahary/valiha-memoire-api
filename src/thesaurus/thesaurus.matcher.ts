import type { ThesaurusCandidate, ThesaurusMatch } from './thesaurus.types.js';

/** Retire les caractères qui auraient un sens (jokers, guillemets, contrôle) dans une requête Skosmos / SPARQL / Lucene */
export function sanitize(raw: string): string {
  return raw.normalize('NFC').replace(/[\p{Cc}*?"\\<>]/gu, ' ').replace(/\s+/g, ' ').trim();
}

/** Comparaison insensible à la casse, aux accents et à la ponctuation */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toSingular(term: string): string {
  return term.length > 3 && /s$/i.test(term) ? term.slice(0, -1) : term;
}

/**
 * Choisit le meilleur candidat : libellé préconisé exact (1) > synonyme exact (0.95) > quasi-exact (0.8).
 * Tolère pluriel / petite variation de fin de mot (« mémoires » ↔ « mémoire »).
 */
export function pickBest(term: string, candidates: readonly ThesaurusCandidate[]): ThesaurusMatch | null {
  const target = normalize(term);
  if (!target) return null;

  let best: { score: number; match: ThesaurusMatch } | null = null;

  for (const c of candidates) {
    const labels = [
      { label: c.prefLabel, isPref: true },
      ...c.altLabels.map((label) => ({ label, isPref: false })),
    ];

    for (const { label, isPref } of labels) {
      const norm = normalize(label);
      if (!norm) continue;

      let score = 0;
      let matchType: ThesaurusMatch['matchType'] = 'near';

      if (norm === target) {
        score = isPref ? 1 : 0.95;
        matchType = isPref ? 'exact' : 'alt';
      } else if (
        Math.abs(norm.length - target.length) <= 2 &&
        (norm.startsWith(target) || target.startsWith(norm))
      ) {
        score = 0.8;
      }

      if (score > (best?.score ?? 0)) {
        best = { score, match: { uri: c.uri, prefLabel: c.prefLabel.trim(), matchedLabel: label, matchType } };
      }
    }
  }
  return best?.match ?? null;
}
