## Review

**P0 (must-fix): none.**

**P1 (architecture): still not a single backend, and Vite middleware remains an active API server.**  
The GOAL requires the standalone server to be the only backend and Vite middleware to be removed (`.agentloop/GOAL.md:24-27`). This repo still imports and installs Vite API plugins in `vite.config.ts:3-4` and `vite.config.ts:25-29`, while `server/runEpisodePlugin.ts:39-112` and `server/nebiusPlugin.ts:55-75` still register live `/api/*` middleware. Recommendation: next round should remove those middleware plugins and make Vite proxy `/api` and `/v1` to the Hono server in `server/main.ts`.

**P1 (architecture): legacy `/api/run-episode` still uses module-global mutable license history.**  
The GOAL explicitly says one evidence schema should avoid module-global mutable state in the request path (`.agentloop/GOAL.md:30-32`). The legacy handler still keeps `serverRecords` as process-global state at `server/runEpisodeHandler.ts:119-122`, derives episode identity from it at `server/runEpisodeHandler.ts:205`, pushes before persistence at `server/runEpisodeHandler.ts:229`, and computes license from it at `server/runEpisodeHandler.ts:231`. This round correctly rolls failed configured writes back at `server/runEpisodeHandler.ts:307-314`, so this is not a regression, but it remains the next trust-boundary debt. Recommendation: after single-backend proxying, drive UI/reference flows through `/v1` or document/contain legacy as dev-only.

**P2 (quality): rollback behavior is implemented but not directly asserted.**  
The design required failed configured episodes not to remain in `serverRecords` (`.agentloop/design.md:35-38` and `.agentloop/design.md:58-60`). The code removes the exact record by reference at `server/runEpisodeHandler.ts:307-309`, which is the right concurrency-safe choice for this narrow handler. The new tests assert fail-closed shape for HTTP 500 and thrown fetch at `server/runEpisodeHandler.test.ts:174-200`, but they do not call `getRecentRuns` or a subsequent successful episode to prove the failed record did not pollute history. Recommendation: add a focused assertion in a later cleanup if this legacy path remains long enough to matter.

**P2 (gates/tests): gates are honest for this scope.**  
The requested gates ran through `npm run gates` at `.agentloop/gates.log:2-3`; build completed at `.agentloop/gates.log:6-17`, evidence verification passed all 40 checks at `.agentloop/gates.log:23-67`, and Vitest passed 6 files / 40 tests at `.agentloop/gates.log:119-124`. The new fail-closed tests are visible in the test log at `.agentloop/gates.log:90-95`.

**Verdict: ACCEPT** for this round’s change. The last `design.md` acceptance criteria were met: configured legacy persistence failures return no trace/license/persistence/runId/auditRow, local-only behavior still works, and verifier/reward/license semantics were not changed.

## Next design

**Objective**  
Make the standalone Hono server the only backend during development by removing Vite-owned API middleware and proxying frontend `/api` plus `/v1` traffic to `server/main.ts`.

**Scope**  
Change only `vite.config.ts`, `package.json` if needed for scripts, and tests/config references directly broken by removing Vite middleware imports. Do not change verifier, reward, license semantics, `/v1` gym behavior, InsForge store APIs, UI behavior, scenario data, or evidence parsing.

**Steps**  
1. Remove `nebiusApiPlugin` and `runEpisodeApiPlugin` imports and plugin registration from `vite.config.ts`.
2. Add Vite dev-server proxy entries for `/api` and `/v1` targeting the standalone server, defaulting to `http://localhost:8787` or the existing server port config if already centralized.
3. Keep `react()` as the only Vite plugin unless another non-backend plugin already exists.
4. Ensure `server/main.ts` remains the implementation of `/health`, `/api/run-episode`, `/api/runs/recent`, `/api/evidence/status`, `/api/nebius-action`, `/api/vapi/tools`, and `/v1/*`.
5. Do not delete handler modules yet if `server/main.ts`, tests, or verification scripts still import them. Remove only Vite middleware wiring this round.
6. Add or update a minimal test/static check only if existing tests do not catch accidental Vite middleware reintroduction.
7. Run the full gates.

**Acceptance criteria**  
- `vite.config.ts` no longer imports or registers `server/runEpisodePlugin.ts` or `server/nebiusPlugin.ts`.
- Vite dev frontend reaches `/api` and `/v1` through proxy config to the standalone Hono server.
- `server/main.ts` is the only runtime owner of backend routes.
- No verifier, reward, license, persistence, digest, scenario, or UI response semantics change.
- Existing evidence, fail-closed, and gym tests remain green.

**Gates**  
`npm run build`  
`npm run lint`  
`npm run verify:evidence`  
`npm test`  
`npm run gates`
