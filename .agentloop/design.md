## Objective
Fail closed on configured InsForge persistence failures so the GOAL’s “One evidence schema” and “Gym is canonical” trust boundary never grants a reward/license unless the verdict was durably saved or safely replayed from a verified existing row.

## Scope
Change only:
- `server/env/gym.ts`
- `server/env/gym.test.ts`

Do NOT touch:
- verifier, reward, or license semantics
- `server/insforgeStore.ts`
- migrations
- legacy `/api/run-episode`
- UI, scenarios, docs, or package scripts

## Steps
1. In `server/env/gym.ts`, update the configured `persistEpisodeOnce` handling in `stepEpisode`.
2. Preserve current success paths:
   - `out.status === "saved"` still returns success with `persisted: true`
   - `out.status === "existing"` with a valid `rowToVerdict(out.row)` still replays the first-written verdict
   - `out.status === "unavailable" && out.code === "conflict_reread_failed"` still fails closed
3. Add a fail-closed branch for every other configured `out.status === "unavailable"` result, including `http_500`, `timeout`, and `unreachable`.
4. That fail-closed response must be `{ ok: false, code: "unknown", error: ... }` and must not include `reward`, `info`, `license`, `persisted`, or `recordId`.
5. Keep unconfigured local dev fallback unchanged; only configured InsForge persistence failures fail closed.
6. In `server/env/gym.test.ts`, add a configured-InsForge test where:
   - run-history GET succeeds with `[]`
   - insert POST returns HTTP 500
   - `stepEpisode` returns `ok: false`, `code: "unknown"`
   - response has no `reward`, `info`, `license`, `persisted`, or `recordId`
7. Add a second configured-InsForge test where:
   - run-history GET succeeds with `[]`
   - insert POST rejects/throws to simulate `unreachable`
   - assert the same fail-closed behavior
8. Ensure existing tests for saved insert, valid conflict replay, conflict reread failure, malformed conflict winner, and history-read failure still pass.

## Acceptance criteria
- Configured `/v1` cannot return a reward or license when InsForge insert fails after scoring.
- Non-conflict persistence failures do not leak verifier info, reward, license, `persisted`, or `recordId`.
- Valid saves and valid conflict rehydration still return successful deterministic results.
- Local unconfigured dev fallback remains unchanged.
- No verifier, reward, or license scoring semantics change.

## Gates
```bash
npm run build
npm run lint
npm run verify:evidence
npm test
npm run gates
```
