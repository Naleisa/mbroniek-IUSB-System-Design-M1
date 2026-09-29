# Manual Checks — CareMatch

Log of manual checks for screen tasks and acceptance criteria (ADR-17). Checks are done at phone size in Chrome DevTools device mode unless noted.

| Task | Date | Checked by | Steps | Result | Notes |
|------|------|------------|-------|--------|-------|
| T1 | 2026-09-29 | Mike Broniek | 1. `npm run build` in `/app` finishes with no errors. 2. `npm run dev` and open `#/`. 3. White navbar shows the CareMatch logo, not stretched and at least 120px wide; clicking it stays on `#/`; the page below is empty. 4. `git status` shows no changes outside `/app` from this task. | Pass | Vue Router pinned to v4; TypeScript pinned to ~5.9 for vue-tsc. |
| T2 | 2026-09-29 | Mike Broniek | 1. `npm test` in `/app` reports 1 test file and 1 test passed, then exits. 2. `npm run build` still finishes with no errors. | Pass | Vitest 5.0.2; `npm test` runs `vitest run` (no watch mode). |
