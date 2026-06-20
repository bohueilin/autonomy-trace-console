## Review

**P0 (must-fix): none.**

**P1 (architecture): configured `/v1` still grants a license when evidence persistence fails after scoring.**  
`server/env/gym.ts:432` calls `persistEpisodeOnce`, but only handles `existing`, `conflict_reread_failed`, and `saved`; every other configured persistence failure falls through as “best-effort” at `server/env/gym.ts:482`, then returns `ok: true` with `reward`, `info`, and `license` at `server/env/gym.ts:493`. The store explicitly returns `unavailable` for non-conflict insert HTTP errors/timeouts at `server/insforgeStore.ts:209` and `server/insforgeStore.ts:214`. That means a configured production gym can award autonomy without durable tamper-evident evidence. Recommendation: in configured mode, fail closed on any `persistEpisodeOnce(...).status === "unavailable"` unless it was already rehydrated as `existing`; return `ok:false, code:"unknown"` with no reward/info/license.

**P2 (quality): current round is correctly implemented and tested.**  
The design required configured history read failures to fail closed before replay/verify/license/persist at `.agentloop/design.md:23` and `.agentloop/design.md:29`. The implementation now returns a typed load result at `server/env/gym.ts:256`, maps non-`ok` InsForge reads to unavailable at `server/env/gym.ts:266`, and exits before verifier/license/persistence at `server/env/gym.ts:317`. Tests cover HTTP 500 and parse-error history reads with no POST and no reward/info/license leakage at `server/env/gym.test.ts:320` and `server/env/gym.test.ts:366`. Gates are honest for this scope: build/lint/evidence/tests ran and ended `GATES: PASS` at `.agentloop/gates.log:6`, `.agentloop/gates.log:19`, `.agentloop/gates.log:23`, `.agentloop/gates.log:69`, and `.agentloop/gates.log:96`.

**Verdict: ACCEPT** for this round’s change. The requested acceptance criteria were met; the P1 above is the next trust-boundary gap, not a regression in this patch.

## Next Design

**Objective**  
Fail closed on configured InsForge persistence failures so `/v1` never returns a reward or autonomy license unless the verdict is either durably saved or safely replayed from a verified first-written row.

**Scope**  
Change only `server/env/gym.ts` and `server/env/gym.test.ts`. Do not change verifier, reward, license semantics, InsForge store APIs, migrations, legacy `/api/run-episode`, UI, or scenarios.

**Steps**  
1. In `stepEpisode`, after `persistEpisodeOnce`, handle every configured `out.status === "unavailable"` as a non-success response.  
2. Keep the existing special message for `conflict_reread_failed`, but make non-conflict failures such as `http_500`, `timeout`, and `unreachable` also return `{ ok:false, code:"unknown", error: ... }`.  
3. Ensure these failures return no `reward`, `info`, `license`, `persisted`, or `recordId`.  
4. Preserve unconfigured dev fallback behavior.  
5. Add tests for configured InsForge where history read succeeds empty, then insert returns HTTP 500. Assert failure, no reward/info/license, and no optimistic persisted flag.  
6. Add a second configured test where insert throws or rejects to simulate timeout/unreachable. Assert the same fail-closed behavior.  
7. Confirm existing saved, replay, valid-conflict, malformed-conflict, and history-read-failure tests still pass.

**Acceptance Criteria**  
- Configured `/v1` cannot award a license from a verdict that was neither persisted nor verified as an existing first-written row.  
- Non-conflict persistence failure does not leak reward, verifier info, license, persisted, or recordId.  
- Valid saves and valid conflict rehydration still return successful deterministic results.  
- Local unconfigured dev fallback remains unchanged.  
- No verifier/reward/license scoring semantics change.

**Gates**  
`npm run build`  
`npm run lint`  
`npm run verify:evidence`  
`npm test`  
`npm run gates`
