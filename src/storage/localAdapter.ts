/**
 * Storage adapter — localStorage implementation.
 *
 * To migrate to Firestore, create `src/storage/firestoreAdapter.ts`
 * implementing the same interface and swap the import in each store.
 */

export interface StorageAdapter {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

const PREFIX = "gestaodoc:";

export const localAdapter: StorageAdapter = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.error("[storage] set error", e);
    }
  },
  remove(key: string): void {
    localStorage.removeItem(PREFIX + key);
  },
};
