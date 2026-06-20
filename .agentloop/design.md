## Objective

Fail closed on configured InsForge persistence failure in the legacy `/api/run-episode` path, satisfying the GOAL’s “One evidence schema” trust boundary while the UI still depends on `/api`.

## Scope

Change only:

- `server/runEpisodeHandler.ts`
- `server/runEpisodeHandler.test.ts`
- `scripts/verifyServerEvidence.mjs` only if an existing evidence assertion explicitly depends on fail-open legacy behavior

Do NOT touch:

- `server/env/gym.ts` or `/v1` behavior
- verifier, reward, or license semantics
- scenario data
- Vite middleware/proxy configuration
- UI files
- migrations or InsForge store APIs

## Steps

1. In `handleRunEpisode`, keep the current request validation, canonical scenario lookup, policy execution, verifier scoring, trace construction, audit-row construction, and digest calculation unchanged.

2. After `const persist = await persistEpisode(auditRow, cfg.insforge)`, add configured-mode fail-closed handling:
   - If `insforgeConfigured(cfg.insforge)` is `true` and `persist.status === "unavailable"`, return `{ ok: false, code: "unknown", error: ... }`.
   - Do this before returning any success response.
   - The failure response must not include `trace`, `license`, `persistence`, `runId`, or `auditRow`.

3. Preserve existing behavior when InsForge is unconfigured:
   - `persist.status === "local_only"` should still allow the local demo response.
   - Existing in-memory server record behavior should remain intact.

4. Prevent failed configured episodes from polluting in-memory license history:
   - Because `serverRecords.push(record)` currently happens before persistence, ensure a configured `unavailable` persistence result does not leave the failed record in `serverRecords`.
   - Keep `runSequence` monotonic; do not try to decrement it.
   - Do not change successful saved behavior.

5. Add `server/runEpisodeHandler.test.ts` coverage for configured InsForge insert HTTP 500:
   - Mock `globalThis.fetch` so the InsForge POST returns HTTP 500.
   - Call `handleRunEpisode({ scenarioId: "com-1", policyMode: "mock" }, cfgWithInsforge)`.
   - Assert `ok === false`, `code === "unknown"`.
   - Assert the response does not have `trace`, `license`, `persistence`, `runId`, or `auditRow`.

6. Add a second `server/runEpisodeHandler.test.ts` case for configured InsForge insert throwing/rejecting:
   - Mock the InsForge POST to throw `TypeError("fetch failed")`.
   - Assert the same fail-closed response shape and no leaked authority fields.

7. Add a regression assertion that an unconfigured InsForge config still returns normal legacy demo output:
   - `ok === true`
   - has `trace`, `license`, `persistence.status === "local_only"`, and `runId`

8. Re-run `scripts/verifyServerEvidence.mjs`. If it fails because it assumes configured persistence failures are success responses, update only that assertion to the new fail-closed contract.

## Acceptance criteria

- Configured `/api/run-episode` cannot return a trace, reward-bearing verifier result, license, run id, persistence DTO, or audit row when persistence is unavailable.
- Failed configured legacy episodes do not remain in `serverRecords` and therefore cannot influence later legacy license computation.
- Unconfigured local dev behavior remains usable and returns the existing demo response shape.
- Existing spoofing, digest, read-back, and evidence checks still pass.
- No verifier, reward, license, scenario, `/v1`, or InsForge store semantics change.

## Gates

```bash
npm run build
npm run lint
npm run verify:evidence
npm test
npm run gates
```
