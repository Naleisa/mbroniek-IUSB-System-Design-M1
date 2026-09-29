/** CSV text for each seed table, keyed by table name (the file name without `.csv`). */
export type SeedFiles = Record<string, string>;

export const SEED_TABLES = [
  'agencies',
  'users',
  'settings',
  'requirement_templates',
  'template_items',
  'caregivers',
  'required_items',
  'consents',
  'replacement_requests',
  'audit_events',
] as const;

/** Fetches the seed CSVs served from `/app/public/seed/`. */
export async function fetchSeedFiles(): Promise<SeedFiles> {
  const entries = await Promise.all(
    SEED_TABLES.map(async (table) => {
      const response = await fetch(`${import.meta.env.BASE_URL}seed/${table}.csv`);
      if (!response.ok) {
        throw new Error(`Could not load seed file ${table}.csv.`);
      }
      return [table, await response.text()] as const;
    }),
  );
  return Object.fromEntries(entries);
}
