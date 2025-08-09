interface CacheItem<T> {
  value: T;
  expires: number;
}

export class LRUCache<T> {
  private cache = new Map<string, CacheItem<T>>();
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize = 1000, defaultTTLMs = 60000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTLMs;
  }

  get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    
    return item.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const expires = Date.now() + (ttlMs || this.defaultTTL);
    
    // Remove oldest item if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, { value, expires });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  clear(): void {
    this.cache.clear();
  }
}

// Cache instances
export const suggestionsCache = new LRUCache<any>(500, 60 * 1000); // 60s
export const dictionariesCache = new LRUCache<any>(10, 24 * 60 * 60 * 1000); // 24h
export const areasCache = new LRUCache<any>(10, 24 * 60 * 60 * 1000); // 24h
export const vacancyDetailsCache = new LRUCache<any>(1000, 10 * 60 * 1000); // 10m

// In-flight request coalescing
export const inFlightRequests = new Map<string, Promise<any>>();

export async function coalesceRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key) as Promise<T>;
  }

  const promise = fn().finally(() => {
    inFlightRequests.delete(key);
  });

  inFlightRequests.set(key, promise);
  return promise;
}
