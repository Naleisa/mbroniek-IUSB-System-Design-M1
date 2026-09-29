import Papa from 'papaparse';
import type { InjectionKey } from 'vue';
import { formatLocalDateTime, resolveRelativeDate } from './relativeDates';
import type { SeedFiles } from './seed';
import type { Row, StorageBackend, StoredDocument } from './storageBackend';
import type { Actor, AuditEvent } from './types';

/**
 * The one interface every screen uses for data (ADR-21). Screens never touch
 * browser storage directly, so a hosted backend can replace this later.
 *
 * Every write records an audit event. Audit events can be read with
 * `list('audit_events')` but never changed or removed (R1, C5, ADR-10).
 */
export interface DataLayer {
  list(table: string): Row[];
  get(table: string, id: string): Row | undefined;
  insert(table: string, row: Row, actor: Actor): Row;
  update(table: string, id: string, changes: Row, actor: Actor): Row;
  putDocument(document: StoredDocument, actor: Actor): Promise<void>;
  getDocument(id: string): Promise<StoredDocument | undefined>;
  listDocuments(): Promise<StoredDocument[]>;
  /** Loads the seed on first start only. Returns true when the seed was loaded. */
  loadSeed(getSeedFiles: () => Promise<SeedFiles>, today?: Date): Promise<boolean>;
}

export const dataLayerKey: InjectionKey<DataLayer> = Symbol('dataLayer');

export const AUDIT_TABLE = 'audit_events';

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

function refuseAuditWrite(table: string): void {
  if (table === AUDIT_TABLE) {
    throw new Error('Audit events can only be added by the data layer. They cannot be changed or removed.');
  }
}

function describeChanges(before: Row, after: Row): string {
  return Object.keys(after)
    .filter((column) => before[column] !== after[column])
    .map((column) => `${column}: ${before[column] ?? ''} → ${after[column]}`)
    .join('; ');
}

export function createDataLayer(backend: StorageBackend): DataLayer {
  function appendAuditEvent(
    actor: Actor,
    event: string,
    details: string,
    table: string,
    record: Row,
  ): void {
    const auditEvent: AuditEvent = {
      id: crypto.randomUUID(),
      caregiver_id: table === 'caregivers' ? record.id : (record.caregiver_id ?? ''),
      occurred_at: formatLocalDateTime(new Date()),
      actor_role: actor.role,
      actor_name: actor.name,
      event,
      details,
      table,
      record_id: record.id,
    };
    backend.writeTable(AUDIT_TABLE, [...backend.readTable(AUDIT_TABLE), { ...auditEvent }]);
  }

  return {
    list: (table) => backend.readTable(table),

    get: (table, id) => backend.readTable(table).find((row) => row.id === id),

    insert: (table, row, actor) => {
      refuseAuditWrite(table);
      const rows = backend.readTable(table);
      const inserted = { ...row, id: row.id || crypto.randomUUID() };
      if (rows.some((existing) => existing.id === inserted.id)) {
        throw new Error(`A ${table} row with id ${inserted.id} already exists.`);
      }
      backend.writeTable(table, [...rows, inserted]);
      appendAuditEvent(actor, 'Created', '', table, inserted);
      return inserted;
    },

    update: (table, id, changes, actor) => {
      refuseAuditWrite(table);
      const rows = backend.readTable(table);
      const index = rows.findIndex((row) => row.id === id);
      if (index === -1) {
        throw new Error(`No ${table} row with id ${id}.`);
      }
      const before = rows[index];
      const updated = { ...before, ...changes, id };
      rows[index] = updated;
      backend.writeTable(table, rows);
      appendAuditEvent(actor, 'Updated', describeChanges(before, updated), table, updated);
      return updated;
    },

    putDocument: async (document, actor) => {
      await backend.putDocument(document);
      appendAuditEvent(actor, 'Document stored', document.meta.file_name ?? '', 'documents', {
        ...document.meta,
        id: document.id,
      });
    },
    getDocument: (id) => backend.getDocument(id),
    listDocuments: () => backend.listDocuments(),

    // Seeding writes directly: the seed carries its own audit history, so it adds no events.
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
