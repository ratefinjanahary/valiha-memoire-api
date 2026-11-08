import { Inject, Injectable, Logger } from '@nestjs/common';
import { resolveThesaurusChain } from './thesaurus.config.js';
import { normalize, pickBest, sanitize, toSingular } from './thesaurus.matcher.js';
import { CircuitBreaker, TtlCache } from './thesaurus.resilience.js';
import type { ThesaurusId } from './thesaurus.schemas.js';
import {
  THESAURUS_STRATEGIES,
  type CandidatePoolOptions,
  type DescriptorCandidate,
  type ResolveOptions,
  type SearchMode,
  type ThesaurusLookup,
  type ThesaurusMatch,
  type ThesaurusStrategy,
} from './thesaurus.types.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 5000;
const FAILURE_THRESHOLD = 3; // échecs consécutifs avant ouverture du circuit (par thésaurus)
const CIRCUIT_OPEN_MS = 60_000;

type Outcome =
  | { kind: 'matched'; match: ThesaurusMatch }
  | { kind: 'not_found' }
  | { kind: 'unavailable'; reason: string };

/**
 * Aiguillage sémantique : domaine du mémoire → chaîne ordonnée de thésaurus → premier descripteur trouvé.
 * Ne lance JAMAIS : une API KO donne `unavailable` et l'appelant passe en mode dégradé.
 */
@Injectable()
export class ThesaurusRoutingService {
  private readonly logger = new Logger(ThesaurusRoutingService.name);
  private readonly strategies: ReadonlyMap<ThesaurusId, ThesaurusStrategy>;
  private readonly breakers = new Map<ThesaurusId, CircuitBreaker>();
  private readonly cache = new TtlCache<ThesaurusMatch | null>(CACHE_TTL_MS, CACHE_MAX_ENTRIES);

  constructor(@Inject(THESAURUS_STRATEGIES) strategies: ThesaurusStrategy[]) {
    this.strategies = new Map(strategies.map((s) => [s.id, s] as const));
    for (const id of this.strategies.keys()) {
      this.breakers.set(id, new CircuitBreaker(FAILURE_THRESHOLD, CIRCUIT_OPEN_MS));
    }
  }

  /** Chaîne de thésaurus (par priorité) applicable à un domaine, restreinte aux stratégies disponibles. */
  getRoute(domaineNom?: string | null): ThesaurusId[] {
    return resolveThesaurusChain(domaineNom).filter((id) => this.strategies.has(id));
  }

  async resolveKeyword(rawTerm: string, domaineNom?: string | null): Promise<ThesaurusLookup> {
    return this.resolveInChain(rawTerm, this.getRoute(domaineNom));
  }

  /**
   * Résout une liste de mots-clés (ordre conservé), concurrence limitée et budget de temps global :
   * au-delà du budget, les mots restants passent en mode dégradé.
   */
  async resolveKeywords(
    terms: readonly string[],
    domaineNom?: string | null,
    { concurrency = 3, budgetMs = 10_000 }: ResolveOptions = {},
  ): Promise<ThesaurusLookup[]> {
    const chain = this.getRoute(domaineNom);
    const deadline = Date.now() + budgetMs;
    const results: ThesaurusLookup[] = terms.map((term) => ({
      status: 'unavailable',
      term,
      tried: [],
      reason: 'not_processed',
    }));
    let next = 0;

    const worker = async (): Promise<void> => {
      while (true) {
        const i = next++;
        const term = terms[i];
        if (term === undefined) return;
        results[i] =
          Date.now() > deadline
            ? { status: 'unavailable', term, tried: [], reason: 'budget_exceeded' }
            : await this.resolveInChain(term, chain);
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, terms.length) }, worker));
    return results;
  }

  /**
   * Réservoir de descripteurs « réels » autour de quelques termes (recherche par préfixe, plusieurs résultats par terme).
   * Sert à compléter les mots-clés quand trop peu de candidats de l'IA ont un descripteur : l'IA choisit ensuite
   * DANS ce réservoir (liste fermée), donc le résultat est forcément un descripteur existant.
   * Interroge le thésaurus principal du domaine, puis les suivants de la chaîne tant que le réservoir est trop petit.
   */
  async searchCandidates(
    terms: readonly string[],
    domaineNom?: string | null,
    { minPool = 24, concurrency = 3, budgetMs = 6000 }: CandidatePoolOptions = {},
  ): Promise<DescriptorCandidate[]> {
    const deadline = Date.now() + budgetMs;
    const cleaned = [...new Set(terms.map(sanitize).filter((t) => normalize(t).length >= 3))];
    const pool = new Map<string, DescriptorCandidate>();

    for (const id of this.getRoute(domaineNom)) {
      if (pool.size >= minPool || Date.now() > deadline) break;
      const strategy = this.strategies.get(id);
      const breaker = this.breakers.get(id);
      if (!strategy || !breaker || breaker.isOpen) continue;

      await this.forEachConcurrent(cleaned, concurrency, async (term) => {
        if (Date.now() > deadline || breaker.isOpen) return;
        try {
          const candidates = await strategy.search(term, 'prefix');
          breaker.recordSuccess();
          for (const c of candidates) {
            if (!pool.has(c.uri)) pool.set(c.uri, { thesaurus: id, uri: c.uri, prefLabel: c.prefLabel.trim() });
          }
        } catch (e: unknown) {
          this.onFailure(id, breaker, e);
        }
      });
    }
    return [...pool.values()];
  }

  private async forEachConcurrent<T>(items: readonly T[], concurrency: number, fn: (item: T) => Promise<void>) {
    let next = 0;
    const worker = async (): Promise<void> => {
      while (true) {
        const item = items[next++];
        if (item === undefined) return;
        await fn(item);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  }

  /* ───────────────────────── Interne ───────────────────────── */

  private async resolveInChain(rawTerm: string, chain: readonly ThesaurusId[]): Promise<ThesaurusLookup> {
    const term = sanitize(rawTerm);
    const key = normalize(term);
    if (key.length < 2) return { status: 'not_found', term, tried: [] };

    const tried: ThesaurusId[] = [];
    const failures: string[] = [];

    for (const [depth, id] of chain.entries()) {
      tried.push(id);
      const outcome = await this.lookupIn(id, term, key);

      if (outcome.kind === 'matched') {
        if (depth > 0) this.logger.debug(`« ${term} » résolu via le thésaurus de repli ${id}`);
        return { status: 'matched', term, descriptor: { thesaurus: id, ...outcome.match }, fallbackDepth: depth };
      }
      if (outcome.kind === 'unavailable') failures.push(`${id}: ${outcome.reason}`);
    }

    // Au moins un thésaurus injoignable et aucun match → « dégradé » (à ré-enrichir plus tard), pas « non trouvé »
    return failures.length > 0
      ? { status: 'unavailable', term, tried, reason: failures.join(' | ') }
      : { status: 'not_found', term, tried };
  }

  private async lookupIn(id: ThesaurusId, term: string, key: string): Promise<Outcome> {
    const strategy = this.strategies.get(id);
    const breaker = this.breakers.get(id);
    if (!strategy || !breaker) return { kind: 'unavailable', reason: 'strategy_missing' };

    const cacheKey = `${id}:${key}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached.value ? { kind: 'matched', match: cached.value } : { kind: 'not_found' };

    if (breaker.isOpen) return { kind: 'unavailable', reason: 'circuit_open' };

    try {
      const match = await this.searchSteps(strategy, term);
      breaker.recordSuccess();
      this.cache.set(cacheKey, match);
      return match ? { kind: 'matched', match } : { kind: 'not_found' };
    } catch (e: unknown) {
      return { kind: 'unavailable', reason: this.onFailure(id, breaker, e) };
    }
  }

  private onFailure(id: ThesaurusId, breaker: CircuitBreaker, e: unknown): string {
    const reason = e instanceof Error ? e.message : String(e);
    if (breaker.recordFailure()) {
      this.logger.warn(`API ${id} injoignable (${reason}) : thésaurus ignoré pendant ${CIRCUIT_OPEN_MS / 1000}s`);
    } else {
      this.logger.debug(`Échec API ${id} (${reason})`);
    }
    return reason;
  }

  /** exact → préfixe → préfixe au singulier ; s'arrête dès qu'un candidat est assez proche */
  private async searchSteps(strategy: ThesaurusStrategy, term: string): Promise<ThesaurusMatch | null> {
    const singular = toSingular(term);
    const steps: Array<{ q: string; mode: SearchMode }> = [
      { q: term, mode: 'exact' },
      { q: term, mode: 'prefix' },
      ...(singular !== term ? [{ q: singular, mode: 'prefix' as const }] : []),
    ];

    for (const { q, mode } of steps) {
      const best = pickBest(term, await strategy.search(q, mode));
      if (best) return best;
    }
    return null;
  }
}