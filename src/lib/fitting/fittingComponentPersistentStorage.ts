import type { FittingComponentCacheEntry } from "./fittingComponentStore";

export const FITTING_COMPONENT_IDB_SCHEMA_VERSION = 1;
export const FITTING_COMPONENT_IDB_NAME = "scintel-fitting-component-cache";
export const FITTING_COMPONENT_IDB_STORE = "entries";

export type FittingComponentPersistentRecord = {
  key: string;
  schemaVersion: number;
  entry: FittingComponentCacheEntry;
  storedAt: number;
};

export type FittingComponentPersistentStorage = {
  get(key: string): Promise<FittingComponentCacheEntry | null>;
  put(key: string, entry: FittingComponentCacheEntry): Promise<void>;
  deleteNamespace(prefix: string): Promise<void>;
  clear(): Promise<void>;
};

function isPersistableEntry(entry: FittingComponentCacheEntry): boolean {
  return entry.status === "resolved" || entry.status === "missing";
}

export function createMemoryFittingComponentPersistentStorage(): FittingComponentPersistentStorage {
  const records = new Map<string, FittingComponentPersistentRecord>();

  return {
    async get(key) {
      const record = records.get(key);
      if (!record || record.schemaVersion !== FITTING_COMPONENT_IDB_SCHEMA_VERSION) {
        return null;
      }
      return record.entry;
    },
    async put(key, entry) {
      if (!isPersistableEntry(entry)) return;
      records.set(key, {
        key,
        schemaVersion: FITTING_COMPONENT_IDB_SCHEMA_VERSION,
        entry,
        storedAt: Date.now(),
      });
    },
    async deleteNamespace(prefix) {
      for (const key of [...records.keys()]) {
        if (key.startsWith(prefix)) records.delete(key);
      }
    },
    async clear() {
      records.clear();
    },
  };
}

function openFittingComponentIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }

    const request = indexedDB.open(
      FITTING_COMPONENT_IDB_NAME,
      FITTING_COMPONENT_IDB_SCHEMA_VERSION,
    );

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FITTING_COMPONENT_IDB_STORE)) {
        db.createObjectStore(FITTING_COMPONENT_IDB_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open fitting IDB"));
  });
}

function idbRequestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export function createIndexedDbFittingComponentPersistentStorage(): FittingComponentPersistentStorage {
  let dbPromise: Promise<IDBDatabase> | null = null;

  const getDb = () => {
    if (!dbPromise) dbPromise = openFittingComponentIdb();
    return dbPromise;
  };

  return {
    async get(key) {
      try {
        const db = await getDb();
        const tx = db.transaction(FITTING_COMPONENT_IDB_STORE, "readonly");
        const store = tx.objectStore(FITTING_COMPONENT_IDB_STORE);
        const record = await idbRequestToPromise(
          store.get(key) as IDBRequest<FittingComponentPersistentRecord | undefined>,
        );
        if (!record || record.schemaVersion !== FITTING_COMPONENT_IDB_SCHEMA_VERSION) {
          return null;
        }
        return record.entry;
      } catch {
        return null;
      }
    },

    async put(key, entry) {
      if (!isPersistableEntry(entry)) return;
      try {
        const db = await getDb();
        const tx = db.transaction(FITTING_COMPONENT_IDB_STORE, "readwrite");
        const store = tx.objectStore(FITTING_COMPONENT_IDB_STORE);
        const record: FittingComponentPersistentRecord = {
          key,
          schemaVersion: FITTING_COMPONENT_IDB_SCHEMA_VERSION,
          entry,
          storedAt: Date.now(),
        };
        await idbRequestToPromise(store.put(record));
      } catch {
        // Persistence is best-effort; memory cache remains authoritative for the session.
      }
    },

    async deleteNamespace(prefix) {
      try {
        const db = await getDb();
        const tx = db.transaction(FITTING_COMPONENT_IDB_STORE, "readwrite");
        const store = tx.objectStore(FITTING_COMPONENT_IDB_STORE);
        const upper = `${prefix}\uffff`;
        const range = IDBKeyRange.bound(prefix, upper, false, true);
        const keys = await idbRequestToPromise(store.getAllKeys(range));
        await Promise.all(keys.map((storeKey) => idbRequestToPromise(store.delete(storeKey))));
      } catch {
        // Best-effort purge.
      }
    },

    async clear() {
      try {
        const db = await getDb();
        const tx = db.transaction(FITTING_COMPONENT_IDB_STORE, "readwrite");
        await idbRequestToPromise(tx.objectStore(FITTING_COMPONENT_IDB_STORE).clear());
      } catch {
        // Best-effort clear.
      }
    },
  };
}

let defaultPersistentStorage: FittingComponentPersistentStorage | null = null;

export function getDefaultFittingComponentPersistentStorage(): FittingComponentPersistentStorage {
  if (!defaultPersistentStorage) {
    defaultPersistentStorage =
      typeof indexedDB === "undefined"
        ? createMemoryFittingComponentPersistentStorage()
        : createIndexedDbFittingComponentPersistentStorage();
  }
  return defaultPersistentStorage;
}
