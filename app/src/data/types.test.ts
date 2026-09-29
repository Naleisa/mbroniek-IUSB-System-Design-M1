import Papa from 'papaparse';
import { describe, expect, expectTypeOf, it } from 'vitest';
import checkOrdersCsv from '../../public/seed/check_orders.csv?raw';
import consentsCsv from '../../public/seed/consents.csv?raw';
import documentsCsv from '../../public/seed/documents.csv?raw';
import requiredItemsCsv from '../../public/seed/required_items.csv?raw';
import {
  CONSENT_DECISIONS,
  CONSENT_TYPES,
  isItemStatus,
  isLifecycleState,
  ITEM_STATUSES,
  LIFECYCLE_STATES,
  type RequiredItem,
} from './types';

function parseCsv(csvText: string): Record<string, string>[] {
  return Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true }).data;
}

describe('caregiver lifecycle state', () => {
  it('allows exactly the seven ADR-08 states, including Not Current', () => {
    expect(LIFECYCLE_STATES).toEqual([
      'Intake In Progress',
      'Intake Complete',
      'Screening In Progress',
      'Eligible',
      'Cleared',
      'Not Current',
      'Review Required',
    ]);

    for (const state of LIFECYCLE_STATES) {
      expect(isLifecycleState(state)).toBe(true);
    }
  });

  it('rejects any other state', () => {
    expect(isLifecycleState('Hired')).toBe(false);
    expect(isLifecycleState('cleared')).toBe(false);
    expect(isLifecycleState('')).toBe(false);
  });
});

describe('required item status', () => {
  it('allows exactly the eight ADR-09 statuses', () => {
    expect(ITEM_STATUSES).toEqual([
      'Pending',
      'Ordered',
      'Delayed',
      'Retryable',
      'Verified',
      'Expiring',
      'Expired',
      'Manual Verification',
    ]);

    for (const status of ITEM_STATUSES) {
      expect(isItemStatus(status)).toBe(true);
    }
    expect(isItemStatus('Approved')).toBe(false);
    expect(isItemStatus('verified')).toBe(false);
  });

  it('gives every item source, method, verification date, and expiration date fields (R2)', () => {
    expectTypeOf<RequiredItem>().toHaveProperty('source').toEqualTypeOf<string>();
    expectTypeOf<RequiredItem>().toHaveProperty('method').toEqualTypeOf<string>();
    expectTypeOf<RequiredItem>().toHaveProperty('verified_date').toEqualTypeOf<string>();
    expectTypeOf<RequiredItem>().toHaveProperty('expiration_date').toEqualTypeOf<string>();
  });
});

describe('seed data matches the types', () => {
  it('required_items.csv has the R2 fields and only ADR-09 statuses', () => {
    const rows = parseCsv(requiredItemsCsv);
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      expect(Object.keys(row)).toEqual(
        expect.arrayContaining(['source', 'method', 'verified_date', 'expiration_date']),
      );
      expect(isItemStatus(row.status), `status "${row.status}"`).toBe(true);
    }
  });

  it('documents.csv and check_orders.csv point to real required items', () => {
    const itemIds = new Set(parseCsv(requiredItemsCsv).map((row) => row.id));
    const itemKeys = new Set(parseCsv(requiredItemsCsv).map((row) => `${row.caregiver_id}:${row.item_key}`));

    const documents = parseCsv(documentsCsv);
    expect(documents.length).toBeGreaterThan(0);
    for (const document of documents) {
      expect(itemKeys, document.id).toContain(`${document.caregiver_id}:${document.item_key}`);
    }

    const checkOrders = parseCsv(checkOrdersCsv);
    expect(checkOrders.length).toBeGreaterThan(0);
    for (const order of checkOrders) {
      expect(itemIds, order.id).toContain(order.required_item_id);
    }
  });

  it('consents.csv has only known consent types and decisions', () => {
    const rows = parseCsv(consentsCsv);
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      expect(CONSENT_TYPES).toContain(row.type);
      expect(CONSENT_DECISIONS).toContain(row.decision);
    }
  });
});
