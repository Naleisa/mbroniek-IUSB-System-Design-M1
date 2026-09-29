import Papa from 'papaparse';
import type { InjectionKey } from 'vue';
import { formatLocalDateTime, resolveRelativeDate } from './relativeDates';
import type { SeedFiles } from './seed';
import type { Row, StorageBackend, StoredDocument } from './storageBackend';
import type { Actor, AuditEvent } from './types';
import { isTestSsn, VAULT_TABLE } from './vault';

/**
 * The one interface every screen uses for data (ADR-21). Screens never touch
 * browser storage directly, so a hosted backend can replace this later.
 *
 * Every write records an audit event. Audit events can be read with
 * `list('audit_events')` but never changed or removed (R1, C5, ADR-10).
 *
 * Full SSNs go only to the vault through `storeSsn`; nothing here reads them
 * back. Caregiver records keep only `ssn_token` and `ssn_last4` (R5, ADR-11).
 */
export interface DataLayer {
  list(table: string): Row[];
  get(table: string, id: string): Row | undefined;
  insert(table: string, row: Row, actor: Actor): Row;
  update(table: string, id: string, changes: Row, actor: Actor): Row;
  /** Puts a test SSN in the vault and keeps only its token and last four on the caregiver. */
  storeSsn(caregiverId: string, ssn: string, actor: Actor): { ssn_token: string; ssn_last4: string };
  putDocument(document: StoredDocument, actor: Actor): Promise<void>;
  getDocument(id: string): Promise<StoredDocument | undefined>;
  listDocuments(): Promise<StoredDocument[]>;
  /** Demo coordinator sign-in against the seeded accounts (ADR-05). Returns the user, or undefined if nothing matches. */
  signIn(email: string, password: string): Row | undefined;
  signOut(): void;
  getSignedInUser(): Row | undefined;
  /** Loads the seed on first start only. Returns true when the seed was loaded. */
  loadSeed(getSeedFiles: () => Promise<SeedFiles>, today?: Date): Promise<boolean>;
}

export const dataLayerKey: InjectionKey<DataLayer> = Symbol('dataLayer');

/** Holds the one signed-in user id; kept like other data so a reload stays signed in. */
const SESSION_TABLE = 'session';

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

function refuseVaultRead(table: string): void {
  if (table === VAULT_TABLE) {
    throw new Error('The SSN vault cannot be read here.');
  }
}

function refuseSsnWrite(table: string, row: Row): void {
  if (table === VAULT_TABLE || (table === 'caregivers' && 'ssn' in row)) {
    throw new Error('SSNs can only be saved through storeSsn, which keeps them in the vault.');
  }
}

function newVaultEntry(caregiverId: string, ssn: string): Row {
  if (!isTestSsn(ssn)) {
    throw new Error('Only test SSNs in the 900 series (900-00-0000 format) can be used in the demo.');
  }
  const token = `tok_${crypto.randomUUID()}`;
  return { id: token, token, caregiver_id: caregiverId, ssn };
}

/** Moves each seeded caregiver's raw `ssn` into the vault, leaving only the token and last four. */
function moveSeedSsnsToVault(caregivers: Row[]): { caregivers: Row[]; vault: Row[] } {
  const vault: Row[] = [];
  const cleaned = caregivers.map(({ ssn, ...caregiver }) => {
    if (!ssn) {
      return caregiver;
    }
    const entry = newVaultEntry(caregiver.id, ssn);
    vault.push(entry);
    return { ...caregiver, ssn_token: entry.token, ssn_last4: ssn.slice(-4) };
  });
  return { caregivers: cleaned, vault };
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

  function update(table: string, id: string, changes: Row, actor: Actor): Row {
    refuseAuditWrite(table);
    refuseSsnWrite(table, changes);
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
  }

  return {
    list: (table) => {
      refuseVaultRead(table);
      return backend.readTable(table);
    },

    get: (table, id) => {
      refuseVaultRead(table);
      return backend.readTable(table).find((row) => row.id === id);
    },

    insert: (table, row, actor) => {
      refuseAuditWrite(table);
      refuseSsnWrite(table, row);
      const rows = backend.readTable(table);
      const inserted = { ...row, id: row.id || crypto.randomUUID() };
      if (rows.some((existing) => existing.id === inserted.id)) {
        throw new Error(`A ${table} row with id ${inserted.id} already exists.`);
      }
      backend.writeTable(table, [...rows, inserted]);
      appendAuditEvent(actor, 'Created', '', table, inserted);
      return inserted;
    },

    update,

    storeSsn: (caregiverId, ssn, actor) => {
      if (!backend.readTable('caregivers').some((row) => row.id === caregiverId)) {
        throw new Error(`No caregivers row with id ${caregiverId}.`);
      }
      const entry = newVaultEntry(caregiverId, ssn);
      const otherEntries = backend.readTable(VAULT_TABLE).filter((row) => row.caregiver_id !== caregiverId);
      backend.writeTable(VAULT_TABLE, [...otherEntries, entry]);

      const ssnLast4 = ssn.slice(-4);
      appendAuditEvent(actor, 'SSN stored', `Last four: ${ssnLast4}`, VAULT_TABLE, {
        id: entry.token,
        caregiver_id: caregiverId,
      });
      update('caregivers', caregiverId, { ssn_token: entry.token, ssn_last4: ssnLast4 }, actor);
      return { ssn_token: entry.token, ssn_last4: ssnLast4 };
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

    signIn: (email, password) => {
      const user = backend
        .readTable('users')
        .find(
          (row) =>
            row.role === 'coordinator' &&
            row.password !== '' &&
            row.email.toLowerCase() === email.trim().toLowerCase() &&
            row.password === password,
        );
      if (!user) {
        return undefined;
      }
      backend.writeTable(SESSION_TABLE, [{ id: 'current', user_id: user.id }]);
      appendAuditEvent({ role: 'coordinator', name: user.display_name }, 'Signed in', '', 'users', user);
      return user;
    },

    signOut: () => {
      const userId = backend.readTable(SESSION_TABLE)[0]?.user_id;
      const user = backend.readTable('users').find((row) => row.id === userId);
      backend.writeTable(SESSION_TABLE, []);
      if (user) {
        appendAuditEvent({ role: 'coordinator', name: user.display_name }, 'Signed out', '', 'users', user);
      }
    },

    getSignedInUser: () => {
      const userId = backend.readTable(SESSION_TABLE)[0]?.user_id;
      return backend.readTable('users').find((row) => row.id === userId);
    },

    // Seeding writes directly: the seed carries its own audit history, so it adds no events.
    loadSeed: async (getSeedFiles, today = new Date()) => {
      if (backend.isSeeded()) {
        return false;
      }

      const files = await getSeedFiles();
      const tables: (readonly [string, Row[]])[] = Object.entries(files).map(
        ([table, csvText]) => [table, parseSeedTable(table, csvText, today)] as const,
      );

      // Seeded SSNs go to the vault; caregiver rows keep only the token and last four (ADR-11).
      const caregiverIndex = tables.findIndex(([table]) => table === 'caregivers');
      if (caregiverIndex !== -1) {
        const { caregivers, vault } = moveSeedSsnsToVault(tables[caregiverIndex][1]);
        tables[caregiverIndex] = ['caregivers', caregivers];
        tables.push([VAULT_TABLE, vault]);
      }

      // Write only after every file parsed, so a bad file leaves storage untouched.
      for (const [table, rows] of tables) {
        backend.writeTable(table, rows);
      }
      backend.markSeeded();
      return true;
    },
  };
}
