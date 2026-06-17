// In-memory sliding window rate limiter
// Suitable for single-server deployment

const requestStore = new Map<string, number[]>();

// Periodic cleanup to prevent memory leaks
const CLEANUP_INTERVAL = 60_000; // 1 minute
let lastCleanup = Date.now();

function cleanup(now: number, windowMs: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const cutoff = now - windowMs;
  for (const [key, timestamps] of requestStore) {
    const filtered = timestamps.filter((t) => t > cutoff);
    if (filtered.length === 0) {
      requestStore.delete(key);
    } else if (filtered.length !== timestamps.length) {
      requestStore.set(key, filtered);
    }
  }
}

export function checkRateLimit(
  key: string,
  maxRequests: number = 5,
  windowMs: number = 60_000
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const windowStart = now - windowMs;

  cleanup(now, windowMs);

  const timestamps = requestStore.get(key) ?? [];
  // Filter to only timestamps within the current window
  const recent = timestamps.filter((t) => t > windowStart);

  if (recent.length >= maxRequests) {
    // Calculate when the oldest request in the window will expire
    const oldestInWindow = recent[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    // Still update the store with cleaned timestamps
    requestStore.set(key, recent);
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
  }

  // Allow the request and record the timestamp
  recent.push(now);
  requestStore.set(key, recent);
  return { allowed: true, retryAfterMs: 0 };
}
