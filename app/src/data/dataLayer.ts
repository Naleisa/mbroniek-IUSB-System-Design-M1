import Papa from 'papaparse';
import type { InjectionKey } from 'vue';
import { resolveRelativeDate } from './relativeDates';
import type { SeedFiles } from './seed';
import type { Row, StorageBackend, StoredDocument } from './storageBackend';

/**
 * The one interface every screen uses for data (ADR-21). Screens never touch
 * browser storage directly, so a hosted backend can replace this later.
 */
export interface DataLayer {
  list(table: string): Row[];
  get(table: string, id: string): Row | undefined;
  insert(table: string, row: Row): Row;
  update(table: string, id: string, changes: Row): Row;
  putDocument(document: StoredDocument): Promise<void>;
  getDocument(id: string): Promise<StoredDocument | undefined>;
  listDocuments(): Promise<StoredDocument[]>;
  /** Loads the seed on first start only. Returns true when the seed was loaded. */
  loadSeed(getSeedFiles: () => Promise<SeedFiles>, today?: Date): Promise<boolean>;
}

export const dataLayerKey: InjectionKey<DataLayer> = Symbol('dataLayer');

function parseSeedTable(table: string, csvText: string, today: Date): Row[] {
  const { data, errors } = Papa.parse<Row>(csvText, { header: true, skipEmptyLines: true });
  if (errors.length > 0) {
    throw new Error(`There was a problem reading seed file ${table}.csv.`);
  }

  // Tables without an id column (for example required_items) get one so every row can be read and updated by id.
  return data.map((row, index) => {
    const resolved: Row = {};
    for (const [column, value] of Object.entries(row)) {
      resolved[column] = resolveRelativeDate(value ?? '', today);
    }
    return { ...resolved, id: resolved.id || `${table}-${index + 1}` };
  });
}

export function createDataLayer(backend: StorageBackend): DataLayer {
  return {
    list: (table) => backend.readTable(table),

    get: (table, id) => backend.readTable(table).find((row) => row.id === id),

    insert: (table, row) => {
      const rows = backend.readTable(table);
      const inserted = { ...row, id: row.id || crypto.randomUUID() };
      if (rows.some((existing) => existing.id === inserted.id)) {
        throw new Error(`A ${table} row with id ${inserted.id} already exists.`);
      }
      backend.writeTable(table, [...rows, inserted]);
      return inserted;
    },

    update: (table, id, changes) => {
      const rows = backend.readTable(table);
      const index = rows.findIndex((row) => row.id === id);
      if (index === -1) {
        throw new Error(`No ${table} row with id ${id}.`);
      }
      const updated = { ...rows[index], ...changes, id };
      rows[index] = updated;
      backend.writeTable(table, rows);
      return updated;
    },

    putDocument: (document) => backend.putDocument(document),
    getDocument: (id) => backend.getDocument(id),
    listDocuments: () => backend.listDocuments(),

    loadSeed: async (getSeedFiles, today = new Date()) => {
      if (backend.isSeeded()) {
        return false;
      }

      const files = await getSeedFiles();
      const tables = Object.entries(files).map(
        ([table, csvText]) => [table, parseSeedTable(table, csvText, today)] as const,
      );

      // Write only after every file parsed, so a bad file leaves storage untouched.
      for (const [table, rows] of tables) {
        backend.writeTable(table, rows);
      }
      backend.markSeeded();
      return true;
    },
  };
}
