import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

/* ───────────────────────── Types publics ───────────────────────── */

export interface UnescoDescriptor {
  /** URI canonique du concept, telle que renvoyée par l'API (http://vocabularies.unesco.org/thesaurus/conceptNNNN) */
  uri: string;
  /** Libellé préconisé (descripteur officiel) dans la langue demandée */
  prefLabel: string;
  /** Libellé qui a effectivement matché (≠ prefLabel si synonyme) */
  matchedLabel: string;
  matchType: 'exact' | 'alt' | 'near';
}

export type UnescoLookup =
  | { status: 'matched'; term: string; descriptor: UnescoDescriptor }
  | { status: 'not_found'; term: string }
  | { status: 'unavailable'; term: string; reason: string };

/* ─────────────── Réponse Skosmos : validation défensive ─────────────── */

const SkosResultSchema = z.object({
  uri: z.string().min(1),
  type: z.array(z.string()).optional(),
  prefLabel: z.string().min(1),
  altLabel: z.string().optional(),
  hiddenLabel: z.string().optional(),
});
type SkosResult = z.infer<typeof SkosResultSchema>;

const SkosEnvelopeSchema = z.object({ results: z.array(z.unknown()).default([]) });

class UnescoApiError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

/* ───────────────────────── Constantes ───────────────────────── */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 2000;
const FAILURE_THRESHOLD = 3; // échecs consécutifs avant ouverture du circuit
const CIRCUIT_OPEN_MS = 60_000; // durée du mode dégradé automatique
const MAX_ATTEMPTS = 2; // 1 essai + 1 retry
const RETRY_DELAY_MS = 300;

@Injectable()
export class UnescoService {
  private readonly logger = new Logger(UnescoService.name);

  private readonly baseUrl = (process.env.UNESCO_API_BASE_URL ?? 'https://vocabularies.unesco.org/rest/v1').replace(/\/+$/, '');
  /** Identifiant Skosmos du vocabulaire (≠ de l'espace de noms des URI, qui est « thesaurus ») */
  private readonly vocabId = process.env.UNESCO_VOCAB_ID ?? 'unesco';
  private readonly lang = process.env.UNESCO_LANG ?? 'fr';
  private readonly timeoutMs = Number(process.env.UNESCO_TIMEOUT_MS ?? 3000);
  private readonly maxHits = 10;

  private readonly cache = new Map<string, { expiresAt: number; descriptor: UnescoDescriptor | null }>();
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;

  /* ───────────────────────── API publique ───────────────────────── */

  /**
   * Cherche le descripteur UNESCO d'un mot-clé. NE LANCE JAMAIS : en cas de problème
   * réseau/API, renvoie { status: 'unavailable' } pour que l'appelant passe en mode dégradé.
   */
  async resolveKeyword(rawTerm: string): Promise<UnescoLookup> {
    const term = this.sanitize(rawTerm);
    const key = this.normalize(term);
    if (key.length < 2) return { status: 'not_found', term };

    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.descriptor
        ? { status: 'matched', term, descriptor: cached.descriptor }
        : { status: 'not_found', term };
    }

    if (Date.now() < this.circuitOpenUntil) {
      return { status: 'unavailable', term, reason: 'circuit_open' };
    }

    try {
      const descriptor = await this.search(term);
      this.consecutiveFailures = 0;
      this.setCache(key, descriptor);
      return descriptor ? { status: 'matched', term, descriptor } : { status: 'not_found', term };
    } catch (e: any) {
      const reason = e?.message ?? String(e);
      this.recordFailure(reason);
      return { status: 'unavailable', term, reason };
    }
  }

  /**
   * Résout une liste de mots-clés (ordre conservé) avec une concurrence limitée
   * et un budget de temps global : au-delà, les mots restants passent en mode dégradé.
   */
  async resolveKeywords(terms: string[], { concurrency = 3, budgetMs = 8000 } = {}): Promise<UnescoLookup[]> {
    const deadline = Date.now() + budgetMs;
    const results = new Array<UnescoLookup>(terms.length);
    let next = 0;

    const worker = async () => {
      while (true) {
        const i = next++;
        if (i >= terms.length) return;
        results[i] =
          Date.now() > deadline
            ? { status: 'unavailable', term: terms[i], reason: 'budget_exceeded' }
            : await this.resolveKeyword(terms[i]);
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, terms.length) }, worker));
    return results;
  }

  /* ───────────────────────── Recherche ───────────────────────── */

  /** exact → préfixe → préfixe au singulier ; s'arrête dès qu'un candidat est assez proche */
  private async search(term: string): Promise<UnescoDescriptor | null> {
    const singular = term.length > 3 && /s$/i.test(term) ? term.slice(0, -1) : term;
    const queries = [term, `${term}*`, ...(singular !== term ? [`${singular}*`] : [])];

    for (const query of queries) {
      const best = this.pickBest(term, await this.fetchSearch(query));
      if (best) return best;
    }
    return null;
  }

  private async fetchSearch(query: string): Promise<SkosResult[]> {
    const params = new URLSearchParams({
      query,
      lang: this.lang,
      vocab: this.vocabId,
      maxhits: String(this.maxHits),
    });
    const url = `${this.baseUrl}/search?${params.toString()}`;

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        if (res.status === 429 || res.status >= 500) throw new UnescoApiError(`HTTP ${res.status}`, true);
        if (!res.ok) throw new UnescoApiError(`HTTP ${res.status}`, false);

        const envelope = SkosEnvelopeSchema.safeParse(await res.json());
        if (!envelope.success) throw new UnescoApiError('Réponse UNESCO inattendue', false);

        return envelope.data.results.flatMap((r) => {
          const parsed = SkosResultSchema.safeParse(r);
          return parsed.success ? [parsed.data] : [];
        });
      } catch (e) {
        lastError = e;
        const retryable = e instanceof UnescoApiError ? e.retryable : true; // timeout / réseau → retry
        if (!retryable || attempt === MAX_ATTEMPTS) break;
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  /* ───────────────────────── Sélection du meilleur candidat ───────────────────────── */

  private pickBest(term: string, results: SkosResult[]): UnescoDescriptor | null {
    const target = this.normalize(term);
    if (!target) return null;

    let best: { score: number; descriptor: UnescoDescriptor } | null = null;

    for (const r of results) {
      // écarte les groupes / micro-thésaurus / collections
      if (r.type?.length && !r.type.includes('skos:Concept')) continue;

      const labels = [
        { label: r.prefLabel, isPref: true },
        ...[r.altLabel, r.hiddenLabel]
          .filter((l): l is string => !!l)
          .map((label) => ({ label, isPref: false })),
      ];

      for (const { label, isPref } of labels) {
        const norm = this.normalize(label);
        let score = 0;
        let matchType: UnescoDescriptor['matchType'] = 'near';

        if (norm === target) {
          score = isPref ? 1 : 0.95;
          matchType = isPref ? 'exact' : 'alt';
        } else if (
          // tolère pluriel / petite variation de fin de mot (« mémoires » ↔ « mémoire »)
          Math.abs(norm.length - target.length) <= 2 &&
          (norm.startsWith(target) || target.startsWith(norm))
        ) {
          score = 0.8;
        }

        if (score > (best?.score ?? 0)) {
          best = {
            score,
            descriptor: { uri: r.uri, prefLabel: r.prefLabel.trim(), matchedLabel: label, matchType },
          };
        }
      }
    }
    return best?.descriptor ?? null;
  }

  /* ───────────────────────── Utilitaires ───────────────────────── */

  /** Retire les caractères qui auraient un sens (jokers, guillemets) dans la requête Skosmos */
  private sanitize(raw: string): string {
    return raw.normalize('NFC').replace(/[*?"\\<>]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /** Comparaison insensible à la casse, aux accents et à la ponctuation */
  private normalize(s: string): string {
    return s
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[’`]/g, "'")
      .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private setCache(key: string, descriptor: UnescoDescriptor | null) {
    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, descriptor });
  }

  private recordFailure(reason: string) {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= FAILURE_THRESHOLD) {
      this.circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
      this.logger.warn(`API UNESCO injoignable (${reason}) : mode dégradé pendant ${CIRCUIT_OPEN_MS / 1000}s`);
    } else {
      this.logger.debug(`Échec API UNESCO (${reason}), ${this.consecutiveFailures}/${FAILURE_THRESHOLD}`);
    }
  }
}