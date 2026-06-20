All gates pass. Implementation complete.

## Implementation Report

Implemented `design.md` exactly — closing the `/v1` first-write-wins hole where a confirmed storage conflict could leak the later computed verdict.

### Files changed
- `server/env/gym.ts`
- `server/env/gym.test.ts`

### Key decisions
1. **`rowToVerdict` hardened (gym.ts).** Added a `CATEGORIES` constant and rewrote the validator to reject a persisted row unless every replay-critical field is authoritative and well-typed:
   - `trace_authority === 'server_authoritative_episode'`
   - non-empty string `trace_id`, `run_id`, `scenario_id`
   - matching verifier/reward/license versions
   - present digest equal to `computeAuditDigest(row)`
   - `passed` boolean; `reward` finite and within `[-1, 1]`; `catastrophic` boolean
   - `category` ∈ {correct, over_cautious, under_cautious, catastrophic}
   - `expected_action`/`actual_action` ∈ `ACTIONS`
   - Removed the old `'unknown'`/`'stop'` defaulting — a malformed field now rejects the whole row instead of silently coercing it.

2. **`stepEpisode` fails closed (gym.ts).** In the `out.status === 'existing'` branch, when `rowToVerdict(out.row)` returns `null`, it now returns `{ ok: false, code: 'unknown', error }` instead of falling through to the newly computed verdict. Added an explicit branch for `out.status === 'unavailable' && out.code === 'conflict_reread_failed'` that also fails closed. Other `unavailable`/`local_only` outcomes keep their best-effort behavior. No reward/info/license/persisted/corrected action is returned on these failures.

3. **Two new tests (gym.test.ts).**
   - Confirmed conflict + empty trace lookup → `conflict_reread_failed` → asserts `ok === false`, `code === 'unknown'`, and no `reward`/`info`/`license`/`persisted` leak.
   - Confirmed conflict + malformed winner row (digest recomputed over the row, so rejection comes from strict field validation on an invalid `category`, not a digest mismatch) → asserts `ok === false`, `code === 'unknown'`, no corrected reward/license/info.
   - Added imports for `computeAuditDigest` and the three version constants.

### Gate results — all PASS
- `npm run build` ✅ (tsc + vite)
- `npm run lint` ✅ (fixed one unused-var TS6133 I introduced)
- `npm run verify:evidence` ✅ (40 checks)
- `npm test` ✅ (33 passed, was 31 — the two new tests plus the unchanged valid-conflict test all green)
- `npm run gates` ✅

### Deferred / open questions for Codex
- None deferred within scope. Adjacent item I did **not** touch (per scope): `loadRunVerdicts` silently treats `fetchRecentEvidence` `unavailable`/`error` as an empty run, so a read failure on the *read-before-write* path could still let a fresh verdict compute and persist where a prior row exists but isn't visible. The unique-index conflict path now catches the persist-time collision, but a future round may want to consider whether read-path unavailability should also be more conservative. Flagging only — not implemented.
