import { LRUCache } from "lru-cache";

const cache = new LRUCache<string, object>({
  max: 500,
  ttl: 1000 * 60 * 5,
});

export function get<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function set<T>(key: string, value: T, ttlMs?: number): void {
  cache.set(key, value as unknown as object, ttlMs ? { ttl: ttlMs } : undefined);
}

export function invalidate(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function invalidateExact(key: string): void {
  cache.delete(key);
}
