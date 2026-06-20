## Review — P0/P1/P2

**P0 — conflict re-read failure lets the later replay win. Verdict: NEEDS-FIX.**  
`server/insforgeStore.ts:199-206` correctly turns a confirmed duplicate insert plus failed trace lookup into `{ status: 'unavailable', code: 'conflict_reread_failed' }`, but `server/env/gym.ts:390-425` ignores that code and falls through to `server/env/gym.ts:436-453`, returning the newly computed action/reward/license. That violates the round’s first-write-wins acceptance criterion for the exact case where storage already proved an earlier row exists. Recommendation: make `stepEpisode` treat `conflict_reread_failed` as a hard replay uncertainty, not best-effort success: either retry the lookup and replay the winner, or return a non-success error such as `unknown/conflict_reread_failed` without returning the corrected action/license.

**P1 — gym rehydration parser is looser than the evidence parser.**  
`server/env/gym.ts:202-228` accepts a row if digest/version/pass/reward are present, then defaults malformed `catastrophic`, `category`, `expected_action`, and `actual_action` values. The stricter evidence parser rejects malformed authority/provenance/action/verdict fields at `server/runEpisodeHandler.ts:400-424`. Recommendation: share a strict persisted-row parser or harden `rowToVerdict` to validate `trace_authority`, `run_id`, `scenario_id`, action enums, finite reward bounds, boolean `catastrophic`, and non-empty required identity before it can influence replay/license.

**P2 — tests miss the failure mode that breaks the invariant.**  
`server/env/gym.test.ts:174-185` covers duplicate conflict plus successful trace lookup, but not duplicate conflict plus failed/empty trace lookup. That is the branch that currently returns the later corrected result. Recommendation: add a test where the second insert returns 409 and the trace lookup returns 500 or `[]`; assert the corrected action is not returned and no improved license is emitted.

**Gates:** `.agentloop/gates.log:67-87` reports build/lint/evidence/tests all passing, but the test suite is not yet honest for the conflict failure path above.

**Verdict: NEEDS-FIX for this round’s change.**

## Next design — the plan for the next round

**Objective**  
Close the remaining `/v1` idempotency hole: once InsForge reports a unique conflict, the environment must never return the later action/reward/license unless it can rehydrate the first-written row.

**Scope**  
Touch only:
- `server/env/gym.ts`
- `server/env/gym.test.ts`
- optionally `server/insforgeStore.ts` if a distinct conflict outcome type is needed

**Steps**  
1. In `stepEpisode`, special-case `out.status === 'unavailable' && out.code === 'conflict_reread_failed'`.
2. Do not fall through to the newly computed verdict for that case.
3. Return a deterministic non-success response, or retry lookup once and replay only if the original row is digest-valid.
4. Harden `rowToVerdict` to reject malformed rows instead of defaulting action/verdict fields.
5. Add tests for 409 plus failed trace lookup and 409 plus malformed winner row.

**Acceptance criteria**  
- A duplicate insert conflict can never return the replayed/corrected action.
- If the winner row cannot be read or validated, the API returns an error/uncertain result, not a forged improved license.
- Valid conflict rehydration still returns the original reward/action/license and record id.
- Malformed persisted rows are rejected before they influence replay/license.

**Gates**  
Run:
```bash
npm run build
npm run lint
npm run verify:evidence
npm test
npm run gates
```
