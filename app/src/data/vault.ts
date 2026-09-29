import type { StorageBackend } from './storageBackend';

/**
 * The SSN vault (R5, C4, ADR-11). Full SSNs live only in this table. The data
 * layer screens use can write to it but never read it; only the vendor
 * adapters are given a reader.
 */
export const VAULT_TABLE = 'ssn_vault';

/** Demo SSNs must be in the 900 series, which is never issued to real people (Spec D1, ADR-12). */
const TEST_SSN = /^9\d{2}-\d{2}-\d{4}$/;

export function isTestSsn(ssn: string): boolean {
  return TEST_SSN.test(ssn);
}

export interface VendorVault {
  /** Returns the full SSN for a token. For vendor adapters only. */
  readSsn(token: string): string | undefined;
}

/** Creates the one reader of full SSNs. Give it to vendor adapters (T20), never to screens. */
export function createVendorVault(backend: StorageBackend): VendorVault {
  return {
    readSsn: (token) => backend.readTable(VAULT_TABLE).find((row) => row.token === token)?.ssn,
  };
}
