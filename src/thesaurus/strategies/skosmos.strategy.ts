import type { SkosmosEndpoint, ThesaurusId } from '../thesaurus.schemas.js';
import { SkosEnvelopeSchema, SkosResultSchema } from '../thesaurus.schemas.js';
import { fetchJson } from '../thesaurus.resilience.js';
import {
  ThesaurusApiError,
  type SearchMode,
  type ThesaurusCandidate,
  type ThesaurusStrategy,
} from '../thesaurus.types.js';

/**
 * API REST Skosmos — commune à UNESCO, AGROVOC et Loterre (MeSH).
 * Seuls `baseUrl` et `vocabId` changent d'un thésaurus à l'autre.
 */
export class SkosmosStrategy implements ThesaurusStrategy {
  private static readonly MAX_HITS = 10;

  constructor(
    readonly id: ThesaurusId,
    private readonly cfg: SkosmosEndpoint,
  ) {}

  async search(term: string, mode: SearchMode): Promise<ThesaurusCandidate[]> {
    const params = new URLSearchParams({
      query: mode === 'prefix' ? `${term}*` : term,
      lang: this.cfg.lang,
      vocab: this.cfg.vocabId,
      maxhits: String(SkosmosStrategy.MAX_HITS),
    });

    const json = await fetchJson(`${this.cfg.baseUrl}/search?${params.toString()}`, {
      timeoutMs: this.cfg.timeoutMs,
    });

    const envelope = SkosEnvelopeSchema.safeParse(json);
    if (!envelope.success) throw new ThesaurusApiError(`Réponse ${this.id} inattendue`, false);

    return envelope.data.results.flatMap((raw): ThesaurusCandidate[] => {
      const parsed = SkosResultSchema.safeParse(raw);
      if (!parsed.success) return [];
      const r = parsed.data;
      // écarte les groupes / micro-thésaurus / collections
      if (r.type?.length && !r.type.includes('skos:Concept')) return [];
      return [
        {
          uri: r.uri,
          prefLabel: r.prefLabel,
          altLabels: [r.altLabel, r.hiddenLabel].filter((l): l is string => !!l),
        },
      ];
    });
  }
}
