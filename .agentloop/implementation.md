Both new tests run and pass. All gates are green.

## Implementation Report

Implemented `design.md` exactly — storage-backed first-write-wins for gym `/v1` evidence idempotency. No objection: the plan is well-scoped, doesn't touch verifier/license semantics, and the partial unique index is the right storage boundary.

### Files changed
- **`migrations/20260620080000_harden-eval-episode-idempotency.sql`** (new): partial `CREATE UNIQUE INDEX IF NOT EXISTS eval_episodes_authoritative_trace_id_uidx ON public.eval_episodes (trace_id) WHERE trace_authority = 'server_authoritative_episode'`, plus a `COMMENT ON INDEX` documenting it as the idempotency storage boundary. No `BEGIN/COMMIT`, no rewrite, no backfill.
- **`server/insforgeStore.ts`**: added `PersistOnceOutcome` type, `fetchEvidenceByTraceId(cfg, traceId)` (single-row lookup, same best-effort `ok/local_only/unavailable/error` contract as `fetchRecentEvidence`), `persistEpisodeOnce(row, cfg)` (conflict-aware insert), and an `isUniqueConflict` helper. `persistEpisode` and `fetchRecentEvidence` left fully intact (still used by `runEpisodeHandler.ts`).
- **`server/env/gym.ts`**: switched gym persistence to `persistEpisodeOnce`; factored the row→verdict rehydration out of `loadRunVerdicts` into a shared `rowToVerdict` helper; on an `existing` (conflict) outcome, rehydrates the winning row and returns the original verdict/action/license with `persisted: true` and the existing `recordId`. Dev fallback unchanged.
- **`server/env/gym.test.ts`**: added a configured-InsForge test with mocked `globalThis.fetch` (restored in `finally`) — com-2, first step `act` persists catastrophic; replay `escalate` with a missed read-before-write + 409 unique conflict + trace lookup returning the original row asserts the correction does **not** win.
- **`server/runEpisodeHandler.test.ts`**: added a regression building the **real** gym `stepEpisode` field shape (`requested_policy_mode/actual_policy_source: 'external'`, `scenario_snapshot`, `actual_policy_input`, `model_name`, digest) and asserting digest-valid + version-compatible (⇒ trusted + license-eligible).
- **`README.md`**: idempotency-invariant note near the InsForge setup section (unique `trace_id`, `npx @insforge/cli db migrations up --all`). No secrets/live values.

### Key decisions
- **Conflict detection**: HTTP 409 is canonical; also treat a 4xx body carrying `23505` / `duplicate key` / `unique constraint` / `already exists` as a conflict. The error body is read for classification only — never logged, never parsed for secrets.
- **Re-read failure after a confirmed conflict** returns `{ status: 'unavailable', code: 'conflict_reread_failed' }` so `existing` always carries a real row; gym then stays best-effort and never lets the later action win.
- Refactored the duplicated rehydration logic into `rowToVerdict` rather than copy-pasting it for the conflict path — same digest/version/type validation reused on both read paths.

### Gate results — all pass
- `npm run build` ✅
- `npm run lint` ✅ (clean)
- `npm run verify:evidence` ✅ (40 checks)
- `npm test` ✅ (31 tests, incl. the 2 new ones, verified individually)

### Deferred / open questions for Codex
- **None deferred within scope.** Adjacent items spotted but intentionally NOT done (per scope): (1) `runEpisodeHandler.ts`'s legacy `/api/run-episode` path still uses `persistEpisode` (non-conflict-aware) — fine for the single-process in-memory history, but if that path ever needs the same storage guarantee it could also adopt `persistEpisodeOnce`; (2) no test exercises the `conflict_reread_failed` branch — covered by code review, not a test, this round.
