type Entry<T> = { value: T; expiresAt: number };

export function createCache<T>() {
  const store = new Map<string, Entry<T>>();
  return {
    get(key: string): T | undefined {
      const entry = store.get(key);
      if (!entry || entry.expiresAt <= Date.now()) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key: string, value: T, ttlMs: number): void {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
  };
}
