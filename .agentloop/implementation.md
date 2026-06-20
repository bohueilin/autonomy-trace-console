All gates pass. Implementation report below.

---

## Implementation report

**Plan assessment:** Sound and correctly scoped — fail-closed on configured persistence failure in the legacy `/api/run-episode` path, satisfying the GOAL's "One evidence schema" trust boundary. Implemented as specified.

### Files changed
- **`server/runEpisodeHandler.ts`** — After `persistEpisode`, added a configured-mode fail-closed branch: if `insforgeConfigured(cfg.insforge)` and `persist.status === 'unavailable'`, roll back the in-memory record and return `{ ok: false, code: 'unknown', error: ... }` — with no `trace`/`license`/`persistence`/`runId`/`auditRow`. Everything upstream (validation, scenario lookup, policy, verifier, trace, audit row, digest) is unchanged.
- **`server/runEpisodeHandler.test.ts`** — Added a `describe` block with three cases: HTTP 500 insert, thrown `TypeError("fetch failed")`, and the unconfigured-demo regression. Imports now include `handleRunEpisode`, `afterEach`, `vi`.

### Key decisions
- **Rollback by reference, not `pop()`.** The plan said "ensure the failed record does not remain in `serverRecords`." Because there's an `await persistEpisode` between the `push` and the rollback, a concurrent episode could push another record in between. I remove the exact record via `indexOf`/`splice(idx, 1)` rather than `pop()`, so I never evict a different (possibly successful) episode. `runSequence` is left untouched (monotonic, never decremented), as required.
- **`record.persistedId` / license:** the popped record never re-enters license computation; `computeLicense` was already called before persist but only mutated the (now-removed) record's `licenseLevel`, so no lingering state.
- **`verifyServerEvidence.mjs` untouched.** Its `cfg` is unconfigured (`insforge: {}`), so every call routes through `local_only` and never hits the new branch — the plan's "only if" condition wasn't met, so no evidence assertion changed.
- **Authority-field leak check in tests** asserts `not.toHaveProperty` for all five fields, matching the acceptance criteria directly.

### Gate results — all pass
- `npm run build` — ✅ tsc + vite build clean
- `npm run lint` — ✅ no eslint errors
- `npm run verify:evidence` — ✅ ALL CHECKS PASSED (40/40)
- `npm test` — ✅ 6 files, 40 tests passed
- `npm run gates` — ✅ green

### Deferred / open questions for Codex
- **`persistEpisodeOnce` / gym `/v1` path** has the same best-effort-on-`unavailable` posture but was out of scope (plan said don't touch `/v1`). If the trust boundary should be uniform, a follow-up round could apply the same fail-closed contract there — flagging as adjacent work, not done.
- **`persist.status === 'existing'`** is not reachable via `persistEpisode` (only `persistEpisodeOnce` returns it), so the legacy path's outcomes remain `saved | local_only | unavailable` — no handling needed.
