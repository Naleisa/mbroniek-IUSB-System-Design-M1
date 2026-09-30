import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VendorVault } from './vault';
import { createMockBackgroundCheck, createMockExclusionCheck, TEST_SSN_OUTCOMES, type VendorResult } from './vendors';

// A vault holding one test SSN per outcome, keyed by token.
const ssns: Record<string, string> = {
  'tok_clear': '900-10-0001',
  'tok_never': '900-12-0003',
  'tok_failure': '900-13-0004',
};
const vault: VendorVault = { readSsn: (token) => ssns[token] };
const DELAY_SECONDS = 10;

/** Places an order and records the result once it arrives. */
function placeOrder(ssnToken: string) {
  const adapter = createMockBackgroundCheck(vault, DELAY_SECONDS);
  const received: { result?: VendorResult } = {};
  void adapter.order({ caregiver_id: 'cg-01', ssn_token: ssnToken }).then((result) => {
    received.result = result;
  });
  return received;
}

describe('mock background check vendor (ADR-01, ADR-12, R9, R10)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns Clear for an SSN ending 0001 after the configured delay', async () => {
    const received = placeOrder('tok_clear');

    await vi.advanceTimersByTimeAsync(DELAY_SECONDS * 1000 - 1);
    expect(received.result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(received.result).toMatchObject({ outcome: 'clear', vendor: 'Mock Background Check' });
    expect(received.result?.reference).toBeTruthy();
  });

  it('never returns for an SSN ending 0003', async () => {
    const received = placeOrder('tok_never');

    await vi.advanceTimersByTimeAsync(DELAY_SECONDS * 1000 * 100);
    expect(received.result).toBeUndefined();
  });

  it('returns a vendor failure for an SSN ending 0004 after the configured delay', async () => {
    const received = placeOrder('tok_failure');

    await vi.advanceTimersByTimeAsync(DELAY_SECONDS * 1000 - 1);
    expect(received.result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(received.result?.outcome).toBe('failure');
  });

  it('returns a vendor failure when the token is not in the vault', async () => {
    const received = placeOrder('tok_unknown');

    await vi.advanceTimersByTimeAsync(DELAY_SECONDS * 1000);
    expect(received.result?.outcome).toBe('failure');
  });

  it('uses the configured delay', async () => {
    const adapter = createMockBackgroundCheck(vault, 2);
    const received: { result?: VendorResult } = {};
    void adapter.order({ caregiver_id: 'cg-01', ssn_token: 'tok_clear' }).then((result) => {
      received.result = result;
    });

    await vi.advanceTimersByTimeAsync(2000);
    expect(received.result?.outcome).toBe('clear');
  });
});

describe('"Test SSNs" hint matches the mock vendors (T62, ADR-12)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists the four reserved endings in order', () => {
    expect(TEST_SSN_OUTCOMES.map((entry) => entry.ending)).toEqual(['0001', '0002', '0003', '0004']);
    expect(TEST_SSN_OUTCOMES.every((entry) => entry.example.startsWith('900-') && entry.example.endsWith(entry.ending))).toBe(true);
  });

  it('gives each example the outcome the hint describes', async () => {
    const vault: VendorVault = { readSsn: (token) => TEST_SSN_OUTCOMES.find((entry) => entry.ending === token)?.example };
    // The exclusion vendor is the one that reports matches; every mock treats the other endings the same way.
    const adapter = createMockExclusionCheck(vault, DELAY_SECONDS, 'OIG');
    const received: Record<string, VendorResult['outcome']> = {};
    for (const entry of TEST_SSN_OUTCOMES) {
      void adapter.order({ caregiver_id: 'cg-01', ssn_token: entry.ending }).then((result) => {
        received[entry.ending] = result.outcome;
      });
    }

    await vi.advanceTimersByTimeAsync(DELAY_SECONDS * 1000 * 100);

    for (const entry of TEST_SSN_OUTCOMES) {
      expect(received[entry.ending], entry.ending).toBe(entry.outcome === 'never' ? undefined : entry.outcome);
    }
  });
});
