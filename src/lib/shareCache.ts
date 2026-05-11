// In-memory share-target cache. Holds shared images briefly between the POST
// from the OS share sheet and the redirect into /agent that consumes them.
// Per-process; for multi-instance prod, swap to Redis or Vercel KV.

const TTL_MS = 5 * 60 * 1000;

interface Entry {
  data: string; // base64 image
  mimeType: string;
  expires: number;
}

const cache = new Map<string, Entry>();

function newId(): string {
  return (
    Math.random().toString(36).slice(2, 10) +
    Date.now().toString(36)
  );
}

export function storeShare(data: string, mimeType: string): string {
  const id = newId();
  cache.set(id, { data, mimeType, expires: Date.now() + TTL_MS });
  return id;
}

export function consumeShare(
  id: string
): { data: string; mimeType: string } | null {
  const entry = cache.get(id);
  if (!entry) return null;
  cache.delete(id);
  if (Date.now() > entry.expires) return null;
  return { data: entry.data, mimeType: entry.mimeType };
}

let cleanupTimer: ReturnType<typeof setInterval> | null = null;
if (!cleanupTimer) {
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (now > v.expires) cache.delete(k);
    }
  }, 60_000);
  cleanupTimer.unref?.();
}
