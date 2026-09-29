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

export type ExclusionList = 'OIG' | 'SAM';

/**
 * Shared mock vendor behavior (ADR-12). The last four digits of the test SSN pick
 * the outcome: 0002 is a match (exclusion vendors only), 0003 never returns,
 * 0004 is a vendor failure, and any other ending is Clear.
 */
function createMockVendor(
  vault: VendorVault,
  delaySeconds: number,
  vendor: string,
  referencePrefix: string,
  matchDetail?: string,
): VendorAdapter {
  let orderCount = 0;

  return {
    vendor,
    order: (request) => {
      orderCount += 1;
      const reference = `${referencePrefix}-${request.caregiver_id}-${orderCount}`;
      const ssn = vault.readSsn(request.ssn_token);
      const ending = ssn?.slice(-4);

      if (ending === '0003') {
        return new Promise<VendorResult>(() => {});
      }
      let result: VendorResult;
      if (!ssn || ending === '0004') {
        result = { outcome: 'failure', vendor, reference, detail: 'The vendor could not complete this check. Try again.' };
      } else if (ending === '0002' && matchDetail) {
        result = { outcome: 'match', vendor, reference, detail: matchDetail };
      } else {
        result = { outcome: 'clear', vendor, reference, detail: 'No records found.' };
      }
      return new Promise((resolve) => setTimeout(() => resolve(result), delaySeconds * 1000));
    },
  };
}

/** The mock background check vendor. An SSN ending 0002 is Clear here; the exclusion vendors report the match. */
export function createMockBackgroundCheck(vault: VendorVault, delaySeconds: number): VendorAdapter {
  return createMockVendor(vault, delaySeconds, BACKGROUND_CHECK_VENDOR, 'BG');
}

/** The mock OIG or SAM exclusion list vendor (R19). An SSN ending 0002 matches on both lists. */
export function createMockExclusionCheck(vault: VendorVault, delaySeconds: number, list: ExclusionList): VendorAdapter {
  return createMockVendor(
    vault,
    delaySeconds,
    `Mock ${list} Exclusion List`,
    list,
    `Name and date of birth match an ${list} exclusion entry. Coordinator review required.`,
  );
}
