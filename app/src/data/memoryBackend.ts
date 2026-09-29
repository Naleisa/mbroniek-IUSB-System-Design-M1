import type { Row, StorageBackend, StoredDocument } from './storageBackend';

/** Keeps everything in memory. Used by Vitest, which has no browser storage. */
export function createMemoryBackend(): StorageBackend {
  const tables = new Map<string, Row[]>();
  const documents = new Map<string, StoredDocument>();
  let seeded = false;

  return {
    readTable: (table) => (tables.get(table) ?? []).map((row) => ({ ...row })),
    writeTable: (table, rows) => {
      tables.set(
        table,
        rows.map((row) => ({ ...row })),
      );
    },
    isSeeded: () => seeded,
    markSeeded: () => {
      seeded = true;
    },
    putDocument: async (document) => {
      documents.set(document.id, document);
    },
    getDocument: async (id) => documents.get(id),
    listDocuments: async () => [...documents.values()],
  };
}
