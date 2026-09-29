import type { VendorVault } from './vault';

/**
 * The shared vendor adapter interface (ADR-01). Background check, exclusion,
 * and registry vendors all take the same request and return the same result,
 * so real vendors can replace the mocks after the pilot.
 */
export interface VendorRequest {
  caregiver_id: string;
  /** The vault token only. The adapter looks up the full SSN itself (ADR-11). */
  ssn_token: string;
}

export type VendorOutcome = 'clear' | 'match' | 'failure';

export interface VendorResult {
  outcome: VendorOutcome;
  vendor: string;
  /** The vendor's reference number for the order. */
  reference: string;
  /** Plain-language summary a coordinator can read. */
  detail: string;
}

export interface VendorAdapter {
  vendor: string;
  /** Places the order. Resolves with the result, or never resolves if the vendor never answers. */
  order(request: VendorRequest): Promise<VendorResult>;
}

export const BACKGROUND_CHECK_VENDOR = 'Mock Background Check';

/**
 * The mock background check vendor (ADR-12). The last four digits of the test SSN
 * pick the outcome: 0003 never returns, 0004 is a vendor failure, and any other
 * ending is Clear (0002 is an exclusion match, which the exclusion vendor handles).
 */
export function createMockBackgroundCheck(vault: VendorVault, delaySeconds: number): VendorAdapter {
  const vendor = BACKGROUND_CHECK_VENDOR;
  let orderCount = 0;

  return {
    vendor,
    order: (request) => {
      orderCount += 1;
      const reference = `BG-${request.caregiver_id}-${orderCount}`;
      const ssn = vault.readSsn(request.ssn_token);
      const ending = ssn?.slice(-4);

      if (ending === '0003') {
        return new Promise<VendorResult>(() => {});
      }
      const result: VendorResult =
        !ssn || ending === '0004'
          ? { outcome: 'failure', vendor, reference, detail: 'The vendor could not complete this check. Try again.' }
          : { outcome: 'clear', vendor, reference, detail: 'No records found.' };
      return new Promise((resolve) => setTimeout(() => resolve(result), delaySeconds * 1000));
    },
  };
}
