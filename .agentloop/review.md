## Review

**P0: None.**

**P1: Persisted winner identity is not bound to the episode being replayed.**  
`rowToVerdict` only requires non-empty `trace_id`, `run_id`, and `scenario_id` at [server/env/gym.ts](/Users/bohueilin/hackathons/0619/autonomy-trace-console/server/env/gym.ts:207), then the conflict branch trusts that verdict at [server/env/gym.ts](/Users/bohueilin/hackathons/0619/autonomy-trace-console/server/env/gym.ts:417). The new malformed-row test exposes this accidentally: it returns a hard-coded `trace_id` ending in `-nonce` at [server/env/gym.test.ts](/Users/bohueilin/hackathons/0619/autonomy-trace-console/server/env/gym.test.ts:265), not the signed episode nonce, and the mock still returns it for any `trace_id=eq.` lookup at [server/env/gym.test.ts](/Users/bohueilin/hackathons/0619/autonomy-trace-console/server/env/gym.test.ts:299). Recommendation: make replay validation compare the persisted row to the expected `{ traceId, runId, scenarioId }`, and add a test where a digest-valid but wrong-identity row fails closed.

**P1: Configured InsForge read failures can still overgrant license on partial history.**  
`loadRunVerdicts` treats `fetchRecentEvidence` `unavailable`/`error` as an empty run at [server/env/gym.ts](/Users/bohueilin/hackathons/0619/autonomy-trace-console/server/env/gym.ts:257). `stepEpisode` then computes a license from only the current verdict at [server/env/gym.ts](/Users/bohueilin/hackathons/0619/autonomy-trace-console/server/env/gym.ts:346) and returns it at [server/env/gym.ts](/Users/bohueilin/hackathons/0619/autonomy-trace-console/server/env/gym.ts:472). That violates “license gate decides” from complete trusted evidence when storage is configured. Recommendation: in configured mode, fail closed before scoring/persisting if run-history read is unavailable; keep the in-memory fallback only when InsForge is explicitly unconfigured.

**P2: Gates pass, but coverage should be tightened.**  
The referee shows build, lint, evidence verification, tests, and overall gates passing at [.agentloop/gates.log](/Users/bohueilin/hackathons/0619/autonomy-trace-console/.agentloop/gates.log:6), [.agentloop/gates.log](/Users/bohueilin/hackathons/0619/autonomy-trace-console/.agentloop/gates.log:23), [.agentloop/gates.log](/Users/bohueilin/hackathons/0619/autonomy-trace-console/.agentloop/gates.log:69), and [.agentloop/gates.log](/Users/bohueilin/hackathons/0619/autonomy-trace-console/.agentloop/gates.log:90). The new tests cover the requested conflict failure modes at [server/env/gym.test.ts](/Users/bohueilin/hackathons/0619/autonomy-trace-console/server/env/gym.test.ts:201) and [server/env/gym.test.ts](/Users/bohueilin/hackathons/0619/autonomy-trace-console/server/env/gym.test.ts:249), but the malformed-row mock should be made identity-realistic.

**Verdict: ACCEPT** for this round’s scoped change. It closes the explicit first-write-wins leak from the last design, and gates pass. The P1s should be the next round.

## Next Design

**Objective**  
Close the remaining configured-InsForge trust-boundary gaps: replayed evidence must match the current episode identity exactly, and license computation must not proceed from partial run history when the DB is configured but unreadable.

**Scope**  
Change only `server/env/gym.ts` and `server/env/gym.test.ts`.

**Steps**  
1. Update `rowToVerdict` or its call sites so persisted rows are rejected unless `trace_id`, `run_id`, and `scenario_id` exactly match expected values when replaying one episode.  
2. Use that exact identity check in the conflict `existing` branch before returning the stored verdict.  
3. Fix the malformed conflict test to capture the actual attempted insert row or token-derived trace id; stop hard-coding `-nonce`.  
4. Add a test for a digest-valid, version-compatible winner row with the wrong `trace_id`, `run_id`, or `scenario_id`; assert `ok === false` and no reward/info/license leaks.  
5. Refactor `loadRunVerdicts` so configured InsForge read failure is distinguishable from an empty successful read.  
6. In `stepEpisode`, if InsForge is configured and run-history read is unavailable/error, return `{ ok: false, code: "unknown" }` before computing or returning a license. Do not attempt insert in that case.  
7. Add a test where the run-history GET returns 500/unparseable, assert no POST occurs and no reward/info/license is returned.  
8. Keep local unconfigured dev fallback behavior unchanged.

**Acceptance Criteria**  
- A conflict winner with mismatched identity cannot influence replay or license.  
- A configured DB read failure cannot produce an optimistic one-episode license.  
- Valid conflict rehydration still returns the first-written verdict and record id.  
- Local dev fallback still works without InsForge credentials.  
- No verifier, reward, or license scoring semantics change.

**Gates**  
Run:

```bash
npm run build
npm run lint
npm run verify:evidence
npm test
npm run gates
```
