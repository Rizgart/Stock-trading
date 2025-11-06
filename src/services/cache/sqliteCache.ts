import type { Database } from 'sql.js';
import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

type StorageAdapter = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const BASE64_PREFIX = 'base64:';

const getStorage = (): StorageAdapter => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }

  const memoryStore: Record<string, string> = {};
  return {
    getItem: (key) => memoryStore[key] ?? null,
    setItem: (key, value) => {
      memoryStore[key] = value;
    },
    removeItem: (key) => {
      delete memoryStore[key];
    }
  };
};

const toBase64 = (data: Uint8Array): string => {
  if (typeof Buffer !== 'undefined') {
    return BASE64_PREFIX + Buffer.from(data).toString('base64');
  }

  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < data.length; index += chunkSize) {
    const chunk = data.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return BASE64_PREFIX + btoa(binary);
};

const fromBase64 = (encoded: string): Uint8Array => {
  const value = encoded.startsWith(BASE64_PREFIX) ? encoded.slice(BASE64_PREFIX.length) : encoded;
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'));
  }

  const binary = atob(value);
  const length = binary.length;
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export interface PersistedCacheEntry<T> {
  value: T;
  expires: number;
}

export class SqliteCache {
  private readonly storage = getStorage();

  private db: Database | null = null;

  private readonly readyPromise: Promise<void>;

  constructor(private readonly storageKey: string = 'aktietipset.cache.db') {
    this.readyPromise = this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    const SQL = await initSqlJs({
      locateFile: () => wasmUrl
    });

    const persisted = this.readPersisted();
    this.db = persisted ? new SQL.Database(persisted) : new SQL.Database();
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache_entries (
        cache_key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        expires INTEGER NOT NULL
      );
    `);
    this.pruneExpiredInternal();
  }

  private async ensureReady(): Promise<void> {
    await this.readyPromise;
  }

  private readPersisted(): Uint8Array | null {
    try {
      const serialized = this.storage.getItem(this.storageKey);
      if (!serialized) {
        return null;
      }
      return fromBase64(serialized);
    } catch (error) {
      console.warn('Kunde inte läsa cache från storage', error);
      return null;
    }
  }

  private persist(): void {
    if (!this.db) {
      return;
    }
    try {
      const data = this.db.export();
      this.storage.setItem(this.storageKey, toBase64(data));
    } catch (error) {
      console.warn('Kunde inte spara cache till storage', error);
    }
  }

  async get<T>(key: string): Promise<PersistedCacheEntry<T> | null> {
    await this.ensureReady();
    if (!this.db) {
      return null;
    }

    const statement = this.db.prepare(
      'SELECT payload, expires FROM cache_entries WHERE cache_key = ? LIMIT 1'
    );
    statement.bind([key]);
    const hasResult = statement.step();
    if (!hasResult) {
      statement.free();
      return null;
    }

    const row = statement.get();
    statement.free();

    try {
      const payload = JSON.parse(row[0]) as T;
      const expires = Number(row[1]);
      if (!Number.isFinite(expires)) {
        return null;
      }
      return { value: payload, expires };
    } catch (error) {
      console.warn(`Kunde inte läsa cache-entry för ${key}`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    await this.ensureReady();
    if (!this.db) {
      return;
    }

    const expires = Date.now() + ttlMs;
    const payload = JSON.stringify(value);
    const statement = this.db.prepare(
      `
      INSERT INTO cache_entries(cache_key, payload, expires)
      VALUES (?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, expires = excluded.expires;
    `
    );
    statement.run([key, payload, expires]);
    statement.free();
    this.persist();
  }

  async delete(key: string): Promise<void> {
    await this.ensureReady();
    if (!this.db) {
      return;
    }

    const statement = this.db.prepare('DELETE FROM cache_entries WHERE cache_key = ?');
    statement.run([key]);
    statement.free();
    this.persist();
  }

  async pruneExpired(): Promise<void> {
    await this.ensureReady();
    this.pruneExpiredInternal();
  }

  private pruneExpiredInternal(): void {
    if (!this.db) {
      return;
    }

    const now = Date.now();
    const statement = this.db.prepare('DELETE FROM cache_entries WHERE expires <= ?');
    statement.run([now]);
    statement.free();
    this.persist();
  }
}
