## Objective

Make gym `/v1` evidence idempotency storage-backed for the GOAL “One evidence schema” and “Gym is canonical” checkboxes: a signed episode’s first verified verdict must be the only authoritative row for its `trace_id`.

## Scope

Create/change exactly:

- `server/insforgeStore.ts`
- `server/env/gym.ts`
- `server/env/gym.test.ts`
- `server/runEpisodeHandler.test.ts`
- `migrations/20260620080000_harden-eval-episode-idempotency.sql`
- `README.md` only for a short note documenting the `trace_id` uniqueness requirement and migration command

Do NOT touch:

- verifier or license scoring semantics
- scenario content/count
- UI components
- Vite middleware consolidation
- Nebius/Vapi handlers
- broader RLS policies beyond what is explicitly listed below

## Steps

1. Add `migrations/20260620080000_harden-eval-episode-idempotency.sql` with one focused invariant:
   - Create a unique index on `public.eval_episodes(trace_id)` for rows where `trace_authority = 'server_authoritative_episode'`.
   - Use a clear index name, for example `eval_episodes_authoritative_trace_id_uidx`.
   - Do not add `BEGIN`/`COMMIT`.
   - Do not attempt a table rewrite or data backfill in this round.
   - Add a SQL comment explaining that this is the storage boundary for gym episode idempotency.

2. In `server/insforgeStore.ts`, add a targeted lookup helper:
   - `fetchEvidenceByTraceId(cfg, traceId)` that uses the existing REST path:
     `/api/database/records/eval_episodes?trace_authority=eq.server_authoritative_episode&trace_id=eq.<encoded>&limit=1`
   - Return the same style as `fetchRecentEvidence`: never throw, never expose secrets, return `ok/local_only/unavailable/error`.
   - Keep the existing `fetchRecentEvidence` API intact.

3. In `server/insforgeStore.ts`, make persistence conflict-aware:
   - Extend `PersistOutcome` or add a new helper named `persistEpisodeOnce`.
   - It must still insert an array body.
   - On normal `2xx`, return the saved record id as today.
   - On duplicate/unique-conflict responses, re-read the existing row by `trace_id` and return an explicit “existing” outcome with the existing row and record id.
   - Treat HTTP `409` as a duplicate. If InsForge surfaces unique violations as another non-2xx status with a recognizable conflict body/code, handle that too, but do not rely on logging or parsing secrets.
   - Non-conflict failures remain `unavailable`.

4. In `server/env/gym.ts`, use the conflict-aware helper for configured InsForge:
   - Before computing a new verdict, keep the existing `loadRunVerdicts` replay check.
   - After computing `auditRow`, call the new conflict-aware persistence helper.
   - If persistence returns `saved`, keep the current response.
   - If persistence returns `existing`, rehydrate the existing row into the same replay response shape used by the earlier `existing` branch: original reward, original `info.actualAction`, original license, `persisted: true`, and existing `recordId`.
   - Do not let the later submitted action improve the response when a conflict occurs.
   - If persistence is `unavailable`, keep current best-effort semantics, but do not append duplicate dev rows.

5. In `server/env/gym.test.ts`, add configured-InsForge mocked `fetch` coverage:
   - Use a config with fake `baseUrl` and `apiKey`.
   - Mock `globalThis.fetch` inside the test and restore it afterward.
   - Scenario: reset `com-2`, first step submits catastrophic `act`.
   - Mock read-before-write as empty, insert as success, and assert the response is catastrophic and persisted.
   - Then replay the same `episodeId` with correct `escalate`.
   - Mock read-before-write as empty again to simulate a race/stale read, mock insert as duplicate conflict, mock trace lookup returning the first persisted catastrophic row.
   - Assert replay returns the original catastrophic result/action, not the corrected action, with `persisted: true` and the original record id.
   - Assert no client-supplied reward/pass/license fields are involved.

6. In `server/runEpisodeHandler.test.ts`, add a focused integration-style parser regression:
   - Build a real gym-shaped row matching fields produced by `stepEpisode`, including `requested_policy_mode: "external"`, `actual_policy_source: "external"`, `scenario_snapshot`, `actual_policy_input`, `model_name`, and `audit_row_digest`.
   - Parse it with `parseEvidenceRow`.
   - Assert it is digest-valid, version-compatible, trusted evidence, and license-eligible.
   - This should use the actual field shape, not only a legacy row with provenance flipped.

7. Add a short README note near the InsForge setup section:
   - State that authoritative evidence requires a unique `trace_id`.
   - Mention applying migrations with `npx @insforge/cli db migrations up --all`.
   - Do not add secrets or live project values.

## Acceptance criteria

- Configured InsForge mode is first-write-wins even when the pre-insert read misses an existing row and the insert hits a unique conflict.
- A replay returns the original verdict/action/license and original record id.
- The database invariant for authoritative evidence uniqueness is documented in a migration.
- Dev fallback replay behavior remains unchanged and still first-write-wins.
- Real gym-produced `external` row shape parses as digest-valid trusted evidence.
- No verifier/license scoring semantics change.

## Gates

```bash
npm run build
npm run lint
npm run verify:evidence
npm test
npm run gates
```
