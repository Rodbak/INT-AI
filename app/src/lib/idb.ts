// Tiny promise-based IndexedDB wrapper — no dependencies.
// Two stores: `kv` (catalog cache: products, customers, settings, cashiers) and
// `queue` (offline sales waiting to sync, keyed by their clientId).

const DB_NAME = 'int-pos';
const DB_VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'clientId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const idb = {
  get: <T>(key: string) => tx<T>('kv', 'readonly', (s) => s.get(key)),
  set: (key: string, value: unknown) => tx<IDBValidKey>('kv', 'readwrite', (s) => s.put(value, key)),

  // Queue of unsynced sales
  queuePut: (sale: { clientId: string; [k: string]: unknown }) => tx<IDBValidKey>('queue', 'readwrite', (s) => s.put(sale)),
  queueAll: <T>() => tx<T[]>('queue', 'readonly', (s) => s.getAll()),
  queueDelete: (clientId: string) => tx<undefined>('queue', 'readwrite', (s) => s.delete(clientId)),
  queueCount: () => tx<number>('queue', 'readonly', (s) => s.count()),
};
