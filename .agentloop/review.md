## Review

**Verdict: ACCEPT for this round's change.** The narrow design was implemented: configured `/v1` insert failures now fail closed without returning reward/info/license/persistence fields, and gates are green.

### P0 (Must-Fix)

None for this round.

### P1 (Architecture)

- `server/runEpisodeHandler.ts:298-314` and `server/main.ts:83-89` — The legacy `/api/run-episode` path still computes and returns `trace`, `license`, and persistence status even when `persistEpisode()` returns `unavailable`. That keeps a fail-open reward/license path alive outside canonical `/v1`, violating the thesis that evidence must be durably saved or safely replayed before autonomy is granted. Recommendation: next round should either route the UI/reference flows through `/v1` or make this legacy handler fail closed on configured InsForge persistence failure before returning any reward/license.

- `vite.config.ts:3-4`, `vite.config.ts:25-29`, and `server/runEpisodePlugin.ts:39-113` — Vite middleware backends are still installed, so the Definition of Done item “standalone server is the ONLY backend” remains unmet. Recommendation: remove Vite API plugins and configure Vite dev proxy to the standalone Hono server.

### P2 (Quality)

- `server/env/gym.test.ts:411-492` covers HTTP 500 and thrown fetch, but not the timeout branch that `persistEpisodeOnce()` maps at `server/insforgeStore.ts:211-214`. The implementation branch is generic enough to catch timeout, so this is not blocking. Recommendation: add a focused timeout/AbortError test when touching this area again.

### Acceptance Check

- `server/env/gym.ts:481-491` now catches all remaining configured `out.status === 'unavailable'` outcomes and returns only `{ ok: false, code: 'unknown', error }`.
- `server/env/gym.test.ts:411-454` verifies configured insert HTTP 500 does not leak `reward`, `info`, `license`, `persisted`, or `recordId`.
- `server/env/gym.test.ts:456-496` verifies configured insert throw/unreachable does not leak those fields.
- Existing saved/conflict/fail-closed paths remain intact at `server/env/gym.ts:433-480`.
- `gates.log` reports `GATES: PASS`; build, lint, evidence verification, and 37 vitest tests passed.

## Next Design

### Objective

Eliminate the remaining fail-open legacy reward/license path by making `/api/run-episode` use the canonical `/v1` environment semantics, or fail closed under configured InsForge when persistence is unavailable.

### Scope

Change only the legacy server path and tests:

- `server/runEpisodeHandler.ts`
- `server/runEpisodeHandler.test.ts`
- `scripts/verifyServerEvidence.mjs` only if evidence expectations need updating

Do not touch verifier/license semantics, scenario data, UI styling, migrations, or `/v1` behavior.

### Steps

1. In `handleRunEpisode`, keep current client spoofing protections and deterministic policy/verifier logic unchanged.
2. When InsForge is configured and `persistEpisode(auditRow, cfg.insforge)` returns `unavailable`, return `{ ok: false, code: 'unknown', error: ... }`.
3. Ensure that failure response does not include `trace`, `license`, `auditRow`, `runId`, reward, verifier info, or persistence DTO.
4. Preserve unconfigured local dev fallback behavior.
5. Add a test where configured InsForge insert returns HTTP 500 and assert `/api` handler fails closed without reward/license/trace.
6. Add a test where configured InsForge insert throws and assert the same.
7. Re-run evidence verification and adjust only if it was depending on fail-open behavior.

### Acceptance Criteria

- Configured `/api/run-episode` cannot return a reward, trace, or license when InsForge persistence fails.
- Unconfigured dev mode still returns normal demo output.
- Existing client-spoofing, digest, read-back, and malformed-row protections still pass.
- No deterministic verifier/reward/license semantics change.

### Gates

```bash
npm run build
npm run lint
npm run verify:evidence
npm test
npm run gates
```
