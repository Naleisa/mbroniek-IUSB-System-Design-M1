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
  /**
   * Applicant magic link (ADR-05). If the email belongs to an applicant, writes a
   * sign-in link to the in-app outbox (ADR-06). Returns whether a link was sent.
   */
  requestSignInLink(email: string, next?: string): boolean;
  signInWithLink(token: string): SignInWithLinkResult;
  signOut(): void;
  getSignedInUser(): Row | undefined;
  /** Loads the seed on first start only. Returns true when the seed was loaded. */
  loadSeed(getSeedFiles: () => Promise<SeedFiles>, today?: Date): Promise<boolean>;
}

export type SignInWithLinkResult = { ok: true; user: Row; next: string } | { ok: false; reason: string };

export const dataLayerKey: InjectionKey<DataLayer> = Symbol('dataLayer');

/** Holds the one signed-in user id; kept like other data so a reload stays signed in. */
const SESSION_TABLE = 'session';

/** Magic-link tokens. Written directly, not through `insert`, so tokens never appear in the audit log. */
const SIGN_IN_LINKS_TABLE = 'sign_in_links';

const DEFAULT_APPLICANT_ROUTE = '/applicant';

/** Only in-app routes are allowed as a link's destination. */
function safeNextRoute(next: string | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : DEFAULT_APPLICANT_ROUTE;
}

/** Builds the hash link an applicant follows to sign in. */
export function signInLinkPath(token: string, next: string): string {
  return `/auth?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;
}

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

/** Tables every agency shares: settings and the one Indiana template (ADR-03). */
const SHARED_TABLES = ['settings', 'requirement_templates', 'template_items'];

const SHARED = 'shared';

/**
 * Which agency a row belongs to (R4, C7): its own id for agencies, its
 * `agency_id`, or its caregiver's agency. Sign-in audit events belong to the
 * user's agency. Rows with no agency (internal tables such as sign-in links)
 * belong to none and are hidden from coordinators.
 */
function agencyOf(table: string, row: Row, backend: StorageBackend): string | undefined {
  if (SHARED_TABLES.includes(table)) {
    return SHARED;
  }
  if (table === 'agencies') {
    return row.id;
  }
  if (row.agency_id) {
    return row.agency_id;
  }
  if (row.caregiver_id) {
    return backend.readTable('caregivers').find((caregiver) => caregiver.id === row.caregiver_id)?.agency_id;
  }
  if (table === AUDIT_TABLE && row.table === 'users') {
    return backend.readTable('users').find((user) => user.id === row.record_id)?.agency_id;
  }
  if (table === AUDIT_TABLE && row.table === 'agencies') {
    return row.record_id;
  }
  return undefined;
}

/**
 * The data layer screens use: a signed-in coordinator reads and writes only
 * their own agency's data, and a signed-in applicant only their own
 * application (R4, R6).
 */
export function createDataLayer(backend: StorageBackend): DataLayer {
  return buildDataLayer(backend, true);
}

/**
 * Unfiltered data layer for scheduled jobs (T24, T25), which must see every
 * agency. Never give it to screens.
 */
export function createSystemDataLayer(backend: StorageBackend): DataLayer {
  return buildDataLayer(backend, false);
}

/** Internal compliance records applicants never see; their item statuses cover R6. */
const HIDDEN_FROM_APPLICANTS = ['check_orders', AUDIT_TABLE];

/**
 * Whether a row belongs to this applicant's own application (R4, R6): their
 * caregiver record and its rows, messages sent to them, their own account and
 * agency, and the shared tables.
 */
function isApplicantRow(table: string, row: Row, applicant: Row): boolean {
  if (SHARED_TABLES.includes(table)) {
    return true;
  }
  if (HIDDEN_FROM_APPLICANTS.includes(table)) {
    return false;
  }
  switch (table) {
    case 'caregivers':
      return row.id === applicant.caregiver_id;
    case 'users':
      return row.id === applicant.id;
    case 'agencies':
      return row.id === applicant.agency_id;
    case 'notifications':
      return row.recipient_user_id === applicant.id;
    default:
      return Boolean(row.caregiver_id) && row.caregiver_id === applicant.caregiver_id;
  }
}

type Viewer = { role: 'coordinator'; agency: string } | { role: 'applicant'; user: Row };

function buildDataLayer(backend: StorageBackend, filtered: boolean): DataLayer {
  /** Who is reading: a signed-in coordinator or applicant, or undefined when no filter applies. */
  function viewer(): Viewer | undefined {
    if (!filtered) {
      return undefined;
    }
    const userId = backend.readTable(SESSION_TABLE)[0]?.user_id;
    const user = backend.readTable('users').find((row) => row.id === userId);
    if (user?.role === 'coordinator') {
      return { role: 'coordinator', agency: user.agency_id };
    }
    if (user?.role === 'applicant') {
      return { role: 'applicant', user };
    }
    return undefined;
  }

  function isVisible(table: string, row: Row, reader: Viewer | undefined): boolean {
    if (!reader) {
      return true;
    }
    if (reader.role === 'applicant') {
      return isApplicantRow(table, row, reader.user);
    }
    const owner = agencyOf(table, row, backend);
    return owner === reader.agency || owner === SHARED;
  }

  function refuseOutOfScopeWrite(table: string, row: Row): void {
    const reader = viewer();
    if (!isVisible(table, row, reader)) {
      throw new Error(
        reader?.role === 'applicant'
          ? 'You can only change your own application.'
          : 'You can only change records for your own agency.',
      );
    }
  }

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
    refuseOutOfScopeWrite(table, before);
    refuseOutOfScopeWrite(table, updated);
    rows[index] = updated;
    backend.writeTable(table, rows);
    appendAuditEvent(actor, 'Updated', describeChanges(before, updated), table, updated);
    return updated;
  }

  return {
    list: (table) => {
      refuseVaultRead(table);
      const reader = viewer();
      return backend.readTable(table).filter((row) => isVisible(table, row, reader));
    },

    get: (table, id) => {
      refuseVaultRead(table);
      const row = backend.readTable(table).find((candidate) => candidate.id === id);
      return row && isVisible(table, row, viewer()) ? row : undefined;
    },

    insert: (table, row, actor) => {
      refuseAuditWrite(table);
      refuseSsnWrite(table, row);
      const rows = backend.readTable(table);
      const inserted = { ...row, id: row.id || crypto.randomUUID() };
      refuseOutOfScopeWrite(table, inserted);
      if (rows.some((existing) => existing.id === inserted.id)) {
        throw new Error(`A ${table} row with id ${inserted.id} already exists.`);
      }
      backend.writeTable(table, [...rows, inserted]);
      appendAuditEvent(actor, 'Created', '', table, inserted);
      return inserted;
    },

    update,

    storeSsn: (caregiverId, ssn, actor) => {
      const caregiver = backend.readTable('caregivers').find((row) => row.id === caregiverId);
      if (!caregiver) {
        throw new Error(`No caregivers row with id ${caregiverId}.`);
      }
      refuseOutOfScopeWrite('caregivers', caregiver);
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

    requestSignInLink: (email, next) => {
      const user = backend
        .readTable('users')
        .find((row) => row.role === 'applicant' && row.email.toLowerCase() === email.trim().toLowerCase());
      if (!user) {
        return false;
      }

      const settings = backend.readTable('settings');
      const windowDays = Number(settings.find((row) => row.key === 'resume_window_days')?.value) || 7;
      const now = new Date();
      const expires = new Date(now);
      expires.setDate(expires.getDate() + windowDays);

      const token = crypto.randomUUID();
      const target = safeNextRoute(next);
      backend.writeTable(SIGN_IN_LINKS_TABLE, [
        ...backend.readTable(SIGN_IN_LINKS_TABLE),
        {
          id: token,
          token,
          user_id: user.id,
          next: target,
          created_at: formatLocalDateTime(now),
          expires_at: formatLocalDateTime(expires),
        },
      ]);

      // The notification service is T27; until then the link is written to the outbox here.
      const firstName = user.display_name.split(' ')[0];
      const notification: Row = {
        agency_id: user.agency_id,
        recipient_user_id: user.id,
        caregiver_id: user.caregiver_id,
        channel: 'email',
        subject: 'Your CareMatch sign-in link',
        body:
          `Hi ${firstName}, use this link to sign in and continue your application. ` +
          `It works for ${windowDays} days: #${signInLinkPath(token, target)}`,
        created_at: formatLocalDateTime(now),
      };
      const inserted = { ...notification, id: crypto.randomUUID() };
      backend.writeTable('notifications', [...backend.readTable('notifications'), inserted]);
      appendAuditEvent({ role: 'system', name: 'CareMatch' }, 'Created', 'Sign-in link emailed', 'notifications', inserted);
      return true;
    },

    signInWithLink: (token) => {
      const link = backend.readTable(SIGN_IN_LINKS_TABLE).find((row) => row.token === token);
      const user = link && backend.readTable('users').find((row) => row.id === link.user_id);
      if (!link || !user) {
        return { ok: false, reason: "This sign-in link isn't valid. Please request a new one." };
      }
      if (link.expires_at < formatLocalDateTime(new Date())) {
        return { ok: false, reason: 'This sign-in link has expired. Please request a new one.' };
      }
      backend.writeTable(SESSION_TABLE, [{ id: 'current', user_id: user.id }]);
      appendAuditEvent({ role: 'applicant', name: user.display_name }, 'Signed in', 'Email link', 'users', user);
      return { ok: true, user, next: link.next };
    },

    signOut: () => {
      const userId = backend.readTable(SESSION_TABLE)[0]?.user_id;
      const user = backend.readTable('users').find((row) => row.id === userId);
      backend.writeTable(SESSION_TABLE, []);
      if (user) {
        const role = user.role === 'applicant' ? 'applicant' : 'coordinator';
        appendAuditEvent({ role, name: user.display_name }, 'Signed out', '', 'users', user);
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
