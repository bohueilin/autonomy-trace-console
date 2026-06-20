All gates green.

## Implementation Report

Implemented the plan in `design.md` exactly — fail closed on configured InsForge run-history read failures so a license can never be computed from partial evidence.

### Files changed
- **`server/env/gym.ts`**
  - Added a `LoadVerdictsResult` discriminated union (`{ status: 'ok'; verdicts }` | `{ status: 'unavailable' }`).
  - Refactored `loadRunVerdicts` to return that type. Unconfigured dev fallback returns `{ status: 'ok', verdicts: devRunStore... }`; a configured InsForge read whose status is not `ok` (i.e. `unavailable` or `error`) returns `{ status: 'unavailable' }` instead of the old `[]`; a successful trusted load returns `{ status: 'ok', verdicts: out }`.
  - In `stepEpisode`, load history *before* replay/verify/license/persist; on `status !== 'ok'` return `{ ok: false, code: 'unknown', error }` with no `reward`/`info`/`license`/`persisted`/`recordId`.
- **`server/env/gym.test.ts`** — added two configured-InsForge tests: (1) run-history GET returns HTTP 500 → `unavailable`; (2) GET returns a 200 non-array body → `error`. Both assert `ok === false`, `code === 'unknown'`, zero POST calls, and absence of `reward`/`info`/`license`/`persisted`/`recordId`.

### Key decisions
- Used a typed result union rather than throwing, matching the existing non-throwing store boundary (`ReadOutcome`).
- Placed the fail-closed check before the existing replay lookup, so an unreadable history never produces an optimistic replay or a new verdict.
- Verified against `insforgeStore.ts:296–305`: HTTP 500 → `unavailable`, non-array → `error` — both covered by `read.status !== 'ok'`.

### Out of scope (untouched per design)
Verifier/license semantics, `insforgeStore.ts`, migrations, legacy `/api/run-episode`, UI, scenario content.

### Gate results — all pass
- `npm run build` ✅
- `npm run lint` ✅ (clean)
- `npm run verify:evidence` ✅ (40 checks, ALL CHECKS PASSED)
- `npm test` ✅ (6 files, 35 tests — was 33, +2 new)
- `npm run gates` ✅

### Open questions for Codex
- The two prior conflict paths (`existing` rehydration, `conflict_reread_failed`) already fail closed and now also benefit from the pre-load guard; no change was needed there. Existing first-write-wins/conflict tests still pass.
- Adjacent (not done): `loadRunVerdicts` swallows `unavailable` vs `error` into one `status: 'unavailable'`. If a future round wants distinct telemetry/error messages for a parse failure vs a network failure, that distinction is currently collapsed.
