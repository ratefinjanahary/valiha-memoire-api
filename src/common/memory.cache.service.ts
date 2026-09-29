import { Injectable, OnModuleDestroy } from '@nestjs/common';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * Cache in-memory simple avec TTL.
 * Utilise setInterval().unref() pour ne pas bloquer la fermeture du process Node.
 */
@Injectable()
export class MemoryCacheService implements OnModuleDestroy {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly timer: ReturnType<typeof setInterval>;

  constructor() {
    // Purge les entrées expirées toutes les 60 secondes sans bloquer le process
    this.timer = setInterval(() => this.purge(), 60_000);
    this.timer.unref();
  }

  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  private purge(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }
}
