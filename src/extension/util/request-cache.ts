export class RequestCache {
  private cache = new Map<string, { data: unknown; expiresAt: number }>();
  private inFlight = new Map<string, Promise<unknown>>();
  private maxEntries: number;

  constructor(cleanupIntervalMs = 5 * 60 * 1000, maxEntries = 0) {
    this.maxEntries = maxEntries;
    const timer = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (value.expiresAt <= now) {
          this.cache.delete(key);
        }
      }
    }, cleanupIntervalMs);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  async wrap<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key);

    if (cached && cached.expiresAt > now) {
      if (this.maxEntries > 0) {
        this.cache.delete(key);
        this.cache.set(key, cached);
      }
      return cached.data as T;
    }

    if (this.inFlight.has(key)) {
      return this.inFlight.get(key) as Promise<T>;
    }

    const promise = fetcher()
      .then((data) => {
        if (ttlMs > 0) {
          if (this.maxEntries > 0 && this.cache.size >= this.maxEntries) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
              this.cache.delete(firstKey);
            }
          }
          this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
        }
        return data;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  invalidate(keyPrefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(keyPrefix)) {
        this.cache.delete(key);
      }
    }
  }

  invalidateExact(key: string): void {
    this.cache.delete(key);
  }
}

export class SimpleLRUCache<K, V> {
  private cache = new Map<K, V>();

  constructor(private maxEntries: number) {}

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const val = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }
}

export const globalRequestCache = new RequestCache(5 * 60 * 1000, 100);
