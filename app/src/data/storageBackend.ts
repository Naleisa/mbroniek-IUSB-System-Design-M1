/** One stored row. Seed values arrive from CSV as text. */
export type Row = Record<string, string>;

/** A stored document file (credential photo or PDF) with its descriptive fields. */
export interface StoredDocument {
  id: string;
  file: Blob;
  meta: Record<string, string>;
}

/**
 * Where the data layer keeps its data (ADR-21). The browser backend uses
 * localStorage for records and IndexedDB for documents; the memory backend
 * is used by tests.
 */
export interface StorageBackend {
  readTable(table: string): Row[];
  writeTable(table: string, rows: Row[]): void;
  isSeeded(): boolean;
  markSeeded(): void;
  putDocument(document: StoredDocument): Promise<void>;
  getDocument(id: string): Promise<StoredDocument | undefined>;
  listDocuments(): Promise<StoredDocument[]>;
  /** Removes every table, document, and the seeded marker ("Reset demo data", T59). */
  clearAll(): Promise<void>;
}
