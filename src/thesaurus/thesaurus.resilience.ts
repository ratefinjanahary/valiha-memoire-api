import { ThesaurusApiError } from './thesaurus.types.js';

/* ───────────────── Cache TTL borné ───────────────── */

export class TtlCache<V> {
  private readonly store = new Map<string, { expiresAt: number; value: V }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
  ) {}

  /** `undefined` = absent/expiré ; sinon `{ value }` (la valeur elle-même peut être `null` = « non trouvé » mis en cache) */
  get(key: string): { value: V } | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return { value: hit.value };
  }

  set(key: string, value: V): void {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { expiresAt: Date.now() + this.ttlMs, value });
  }
}

/* ───────────────── Circuit breaker (un par thésaurus) ───────────────── */

export class CircuitBreaker {
  private consecutiveFailures = 0;
  private openUntil = 0;

  constructor(
    private readonly threshold: number,
    private readonly openMs: number,
  ) {}

  get isOpen(): boolean {
    return Date.now() < this.openUntil;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  /** @returns true si ce échec a (ré)ouvert le circuit */
  recordFailure(): boolean {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.threshold) {
      this.openUntil = Date.now() + this.openMs;
      return true;
    }
    return false;
  }
}

/* ───────────────── fetch JSON avec timeout + 1 retry ───────────────── */

export interface FetchJsonOptions {
  timeoutMs: number;
  headers?: Record<string, string>;
  maxAttempts?: number;
  retryDelayMs?: number;
}

export async function fetchJson(
  url: string,
  { timeoutMs, headers, maxAttempts = 2, retryDelayMs = 300 }: FetchJsonOptions,
): Promise<unknown> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', ...headers },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.status === 429 || res.status >= 500) throw new ThesaurusApiError(`HTTP ${res.status}`, true);
      if (!res.ok) throw new ThesaurusApiError(`HTTP ${res.status}`, false);

      try {
        return (await res.json()) as unknown;
      } catch {
        throw new ThesaurusApiError('Réponse non JSON', false);
      }
    } catch (e) {
      lastError = e;
      const retryable = e instanceof ThesaurusApiError ? e.retryable : true; // timeout / réseau → retry
      if (!retryable || attempt === maxAttempts) break;
      await new Promise((r) => setTimeout(r, retryDelayMs));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
