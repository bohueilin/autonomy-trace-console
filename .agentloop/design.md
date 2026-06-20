## Objective

Fail closed on configured InsForge run-history read failures so the GOAL’s “One evidence schema” and “Gym is canonical” trust boundary cannot compute licenses from partial evidence.

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

1. In `server/env/gym.ts`, refactor `loadRunVerdicts` so it no longer returns `[]` for every non-`ok` configured InsForge read.
   - Keep unconfigured dev fallback returning the in-memory verdict list.
   - In configured mode, return a typed result that distinguishes:
     - successful trusted history load
     - unavailable/error history read

2. Update `stepEpisode` to handle the new `loadRunVerdicts` result before checking replay or computing a new verdict.
   - If InsForge is configured and history read is `unavailable` or `error`, return `{ ok: false, code: "unknown", error: ... }`.
   - Do this before verifier scoring, license computation, or persistence.
   - Do not return `reward`, `info`, `license`, `persisted`, or `recordId` on this failure.

3. Preserve current behavior for unconfigured local dev fallback.
   - Existing in-memory replay/idempotency tests must still pass.
   - The dev fallback should still compute and return a license from in-memory history.

4. Add a configured-InsForge test in `server/env/gym.test.ts` where the run-history GET returns HTTP 500 before any insert.
   - Call `resetEpisode` for `com-2`.
   - Call `stepEpisode` with a valid action.
   - Assert `ok === false` and `code === "unknown"`.
   - Assert no POST request occurs.
   - Assert no `reward`, `info`, `license`, `persisted`, or `recordId` is present.

5. Add a second configured-InsForge test where the run-history GET returns a non-array JSON body.
   - Assert the same fail-closed behavior.
   - This covers `fetchRecentEvidence` returning `error`, not only `unavailable`.

6. Ensure existing conflict tests still pass.
   - Valid conflict rehydration must still return the first-written verdict.
   - `conflict_reread_failed` must still fail closed as implemented last round.

## Acceptance criteria

- Configured InsForge read failure cannot produce an optimistic one-episode license.
- Configured InsForge read failure cannot attempt persistence.
- Configured InsForge parse failure behaves the same as read failure.
- Local unconfigured dev fallback behavior is unchanged.
- No verifier, reward, or license semantics change.

## Gates

```bash
npm run build
npm run lint
npm run verify:evidence
npm test
npm run gates
```
