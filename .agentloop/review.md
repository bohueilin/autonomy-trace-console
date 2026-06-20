## Review

**P0 (must-fix): none.**

**P1 (architecture): Gym is still not canonical; the UI/reference flow still centers legacy `/api` and client-local traces.**  
The round met its docs/comment scope, but against the GOAL this remains the next major blocker. `server/main.ts:12-14` still labels `/api/run-episode` and related routes as “Legacy (current UI + reference flows)”. The primary UI button calls `runEpisode` at `src/App.tsx:217-224`, which builds a client-authored trace via local `verify` and local `computeLicense` (`src/App.tsx:38`, `src/App.tsx:61-78`, `src/App.tsx:93-103`). The “server-owned” path still posts to `/api/run-episode`, not `/v1`, at `src/serverEpisodeClient.ts:12-20`. Recommendation: next round should introduce a frontend `/v1` gym client and make reset/step the path for reference-agent episodes, leaving `/api` only for compatibility/status while migrating.

**P1 (architecture/trust boundary): legacy `/api/run-episode` still bakes policies into the server and uses module-global run state.**  
The GOAL wants “Mock and Nebius are reference agents that call the env, not policies baked into the server” and “No module-global mutable state in the request path.” `handleRunEpisode` runs mock/Nebius policy inside the server at `server/runEpisodeHandler.ts:142-199`, then computes trace/license from module globals at `server/runEpisodeHandler.ts:119-136` and `server/runEpisodeHandler.ts:205-232`. This is not a regression from this docs-only round, and the client cannot forge reward/license through this path, but it is still not the intended RL-environment boundary. Recommendation: route reference agents through `/v1/episodes` + `/v1/.../step` and then retire or demote `/api/run-episode`.

**P2 (docs quality): README still says InsForge read-back/rehydration is deferred, which now contradicts the gates and code.**  
`README.md:45-48` says “Still deferred: InsForge read-back / rehydration,” but `.agentloop/gates.log:30` verifies read-back parsing and `.agentloop/gates.log:44-65` verifies read-back gating, digest validity, tamper exclusion, and external gym rows. Recommendation: update that README summary so demo docs do not understate the tamper-evident evidence story.

**P2 (gates/tests): gates are green and honest for this round’s narrow scope.**  
The full gate command ran at `.agentloop/gates.log:2-3`; build passed at `.agentloop/gates.log:6-17`, lint produced no errors at `.agentloop/gates.log:19-20`, evidence verification passed all 40 checks at `.agentloop/gates.log:23-67`, and Vitest passed 6 files / 40 tests at `.agentloop/gates.log:69-124`. Since the change is docs/comments only, no new test was required.

**Verdict: ACCEPT.**  
The last `design.md` acceptance criteria were met: `.env.example` no longer contains `VITE_BACKEND_ORIGIN`, README documents the Vite proxy override as shell env only, deleted Vite middleware/plugin references are gone, and no runtime behavior changed.

## Next design

**Objective**  
Make `/v1` reset/step the canonical frontend/reference-agent path for single episodes, reducing dependence on legacy `/api/run-episode`.

**Scope**  
Change only the frontend episode client/UI wiring and minimal shared types needed for `/v1`. Do not change verifier, reward, license semantics, scenario data, digest format, InsForge persistence, or server `/v1` behavior.

**Steps**  
1. Add a small frontend gym client for `POST /v1/episodes` and `POST /v1/episodes/:episodeId/step`.
2. For single “Run Episode”, call `/v1` reset, let the selected reference agent propose an action from the returned observation, then submit only `{ action }` to `/v1/.../step`.
3. Keep the server-authoritative result from `/v1` as the displayed trace/license source; do not recompute license from client traces for that path.
4. Leave legacy `/api/run-episode` reachable for now, but rename/demote the UI affordance if retained so `/v1` is visibly primary.
5. Update README wording that says read-back is deferred.
6. Add focused tests or a static check if any new client mapping logic is non-trivial.

**Acceptance criteria**  
- The primary single-episode UI path uses `/v1/episodes` + `/v1/.../step`.
- The client sends only an action to step; it never sends reward, verifier result, scenario answer, license, or catastrophic flags.
- `/api/run-episode` is no longer presented as the canonical episode path.
- Existing evidence/digest/fail-closed tests remain green.
- README no longer claims InsForge read-back is deferred.

**Gates**  
`npm run build`  
`npm run lint`  
`npm run verify:evidence`  
`npm test`  
`npm run gates`
