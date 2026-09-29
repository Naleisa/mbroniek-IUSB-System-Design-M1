import type { Row, StorageBackend, StoredDocument } from './storageBackend';

const KEY_PREFIX = 'carematch:';
const SEEDED_KEY = `${KEY_PREFIX}seeded`;
const DB_NAME = 'carematch';
const DOCUMENT_STORE = 'documents';

function openDocumentDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(DOCUMENT_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runDocumentRequest<T>(
  mode: IDBTransactionMode,
  makeRequest: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDocumentDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = makeRequest(db.transaction(DOCUMENT_STORE, mode).objectStore(DOCUMENT_STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/** Records in localStorage (one key per table), document files in IndexedDB (ADR-21). */
export function createBrowserBackend(): StorageBackend {
  return {
    readTable: (table) => {
      const stored = localStorage.getItem(`${KEY_PREFIX}${table}`);
      return stored ? (JSON.parse(stored) as Row[]) : [];
    },
    writeTable: (table, rows) => {
      localStorage.setItem(`${KEY_PREFIX}${table}`, JSON.stringify(rows));
    },
    isSeeded: () => localStorage.getItem(SEEDED_KEY) === 'true',
    markSeeded: () => {
      localStorage.setItem(SEEDED_KEY, 'true');
    },
    putDocument: async (document) => {
      await runDocumentRequest('readwrite', (store) => store.put(document));
    },
    getDocument: (id) =>
      runDocumentRequest<StoredDocument | undefined>('readonly', (store) => store.get(id)),
    listDocuments: () => runDocumentRequest<StoredDocument[]>('readonly', (store) => store.getAll()),
  };
}
