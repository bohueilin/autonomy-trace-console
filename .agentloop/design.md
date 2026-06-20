## Objective

Close the remaining `/v1` first-write-wins hole for the GOAL “Gym is canonical” and “One evidence schema” checkboxes: a confirmed storage conflict must never return the later computed action/license unless the first-written row is validly rehydrated.

## Scope

Change only:

- `server/env/gym.ts`
- `server/env/gym.test.ts`

Do NOT touch:

- verifier or license scoring semantics
- `server/insforgeStore.ts`
- migrations
- legacy `/api/run-episode`
- UI files
- scenario content/count

## Steps

1. In `server/env/gym.ts`, harden `rowToVerdict` so persisted rows influence replay/license only if all required authoritative fields are valid:
   - `trace_authority === "server_authoritative_episode"`
   - non-empty string `trace_id`, `run_id`, and `scenario_id`
   - current verifier/reward/license versions
   - `audit_row_digest` present and equal to `computeAuditDigest(row)`
   - `passed` is boolean
   - `reward` is finite and within `[-1, 1]`
   - `catastrophic` is boolean
   - `category` is one of `correct | over_cautious | under_cautious | catastrophic`
   - `expected_action` and `actual_action` are in `ACTIONS`
   - no defaulting to `unknown` or `stop` for malformed persisted fields

2. In `stepEpisode`, keep the existing `out.status === "existing"` replay path, but change the invalid-winner case:
   - if `rowToVerdict(out.row)` returns `null`, return `{ ok: false, code: "unknown", error: ... }`
   - do not fall through to the newly computed verdict
   - do not return reward, info, license, `persisted: true`, or the corrected action

3. In `stepEpisode`, special-case confirmed conflict re-read failure:
   - if `out.status === "unavailable" && out.code === "conflict_reread_failed"`, return `{ ok: false, code: "unknown", error: ... }`
   - do not fall through to the newly computed verdict
   - keep other `unavailable` outcomes as current best-effort behavior

4. In `server/env/gym.test.ts`, add a configured-InsForge test for conflict plus failed/empty trace lookup:
   - mock read-before-write as empty
   - mock insert as `409` duplicate/unique conflict
   - mock `fetchEvidenceByTraceId` as `500` or `[]`
   - call `stepEpisode` with the corrected action for `com-2`
   - assert `ok === false`, `code === "unknown"`, and no corrected reward/license is returned

5. In `server/env/gym.test.ts`, add a configured-InsForge test for conflict plus malformed winner row:
   - return a trace lookup row that is digest-valid but has an invalid persisted action, category, reward, or `catastrophic`
   - recompute `audit_row_digest` for that malformed row so the rejection is from strict field validation, not only digest mismatch
   - assert `ok === false` and the later corrected action/license is not returned

6. Ensure the existing valid-conflict test still passes:
   - duplicate conflict plus valid winner row returns the original catastrophic result/action/license and original record id

## Acceptance criteria

- A confirmed duplicate conflict with unreadable winner row returns a non-success response.
- A confirmed duplicate conflict with malformed winner row returns a non-success response.
- Neither failure mode can return the later corrected action, reward, or improved license.
- Valid conflict rehydration still returns the original first-written verdict and record id.
- Persisted gym rows with malformed replay-critical fields are rejected before they affect license computation.
- No verifier/license scoring semantics change.

## Gates

```bash
npm run build
npm run lint
npm run verify:evidence
npm test
npm run gates
```
