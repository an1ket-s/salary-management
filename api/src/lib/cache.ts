import redis from "./redis.js";

const DEFAULT_TTL = 3_600; // 1 hour

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },

  async set(key: string, value: unknown, ttl = DEFAULT_TTL): Promise<void> {
    try {
      await redis.set(key, JSON.stringify(value), { EX: ttl });
    } catch {
      // cache write failure is non-fatal
    }
  },

  async del(...keys: string[]): Promise<void> {
    try {
      if (keys.length > 0) await redis.del(keys);
    } catch {
      // ignore
    }
  },
};
