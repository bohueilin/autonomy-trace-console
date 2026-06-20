## Review

Verdict: ACCEPT for this round’s schema-unification change.

P0: None.

P1: Scope breach: the design explicitly said not to touch gym replay/idempotency logic, but this commit changed `server/env/gym.ts` and `server/env/gym.test.ts`. See [.agentloop/design.md](/Users/bohueilin/hackathons/0619/autonomy-trace-console/.agentloop/design.md:13) and [server/env/gym.ts](/Users/bohueilin/hackathons/0619/autonomy-trace-console/server/env/gym.ts:272). The change looks directionally correct, but it violates the two-agent protocol’s small-diff boundary. Recommendation: next round should either fully validate the gym idempotency work or revert it intentionally.

P1: `/v1` first-write-wins is still not atomic with configured InsForge. `stepEpisode` loads prior verdicts, checks `existing`, then later writes, so two concurrent steps for the same signed episode can both miss the row and both persist conflicting rows. See [server/env/gym.ts](/Users/bohueilin/hackathons/0619/autonomy-trace-console/server/env/gym.ts:275) and [server/env/gym.ts](/Users/bohueilin/hackathons/0619/autonomy-trace-console/server/env/gym.ts:382). Recommendation: enforce uniqueness at the storage boundary on `trace_id` or an explicit idempotency key, use insert-conflict handling, then re-read and return the winning verdict.

P1: Trust boundary remains DB-write-authenticated, not digest-authenticated. `parseEvidenceRow` accepts any row with allowed provenance and a recomputed plain SHA digest, and license status includes any compatible non-mismatched row. See [server/runEpisodeHandler.ts](/Users/bohueilin/hackathons/0619/autonomy-trace-console/server/runEpisodeHandler.ts:417), [server/runEpisodeHandler.ts](/Users/bohueilin/hackathons/0619/autonomy-trace-console/server/runEpisodeHandler.ts:444), and [server/runEpisodeHandler.ts](/Users/bohueilin/hackathons/0619/autonomy-trace-console/server/runEpisodeHandler.ts:617). This is acceptable for the current service-key-only prototype, but not production hardening. Recommendation: pair InsForge RLS/service-only writes with either server-only write isolation or an HMAC/signature if untrusted writers may ever reach the table.

P2: The new external evidence tests use a synthetic legacy-shaped row, not an actual `/v1` row produced by `stepEpisode`. See [scripts/verifyServerEvidence.mjs](/Users/bohueilin/hackathons/0619/autonomy-trace-console/scripts/verifyServerEvidence.mjs:349) and [server/runEpisodeHandler.test.ts](/Users/bohueilin/hackathons/0619/autonomy-trace-console/server/runEpisodeHandler.test.ts:52). Recommendation: add a focused mocked-persistence test that steps the gym, captures the persisted audit row, and proves `parseEvidenceRow` and `/api/evidence/status` include it as trusted external evidence.

P2: The previous design file has stray trailing text after the gates fence at [.agentloop/design.md](/Users/bohueilin/hackathons/0619/autonomy-trace-console/.agentloop/design.md:65). Recommendation: overwrite cleanly in the next design.

Acceptance criteria: Met. `EvidencePolicySource` keeps `AgentSource` narrow, `parseEvidenceRow` accepts `external`, unknown provenance is rejected, compact rows type-check, and digest checks still pass. Gates are green per [.agentloop/gates.log](/Users/bohueilin/hackathons/0619/autonomy-trace-console/.agentloop/gates.log:87).

## Next design

Objective: Make gym `/v1` evidence idempotency production-shaped and prove real gym external rows flow into trusted evidence.

Scope:
- `server/env/gym.ts`
- `server/env/gym.test.ts`
- `server/insforgeStore.ts`
- `server/runEpisodeHandler.test.ts`
- `scripts/verifyServerEvidence.mjs`
- Optional migration/docs stub only if needed to express the unique `trace_id` requirement.

Steps:
1. Add an explicit storage-level idempotency plan for gym rows: `trace_id` must be unique for authoritative evidence.
2. Update `persistEpisode` or add a gym-specific persistence helper so duplicate `trace_id` writes do not create conflicting authoritative rows.
3. On duplicate/conflict, re-read the existing row and return the original verdict, reward, info, license, and record id.
4. Keep the dev fallback behavior first-write-wins, but add a test for configured-persistence replay/concurrent duplicate behavior using mocked fetch.
5. Add a test that runs `resetEpisode` + `stepEpisode`, captures the actual persisted `/v1` audit row, parses it with `parseEvidenceRow`, and proves it is trusted/license-eligible.
6. Do not change verifier or license scoring semantics.

Acceptance criteria:
- Replaying the same episode cannot overwrite or improve the first verdict in dev fallback or configured persistence mode.
- Duplicate/concurrent same-episode writes produce at most one authoritative row per `trace_id`.
- The response for a replay returns the original action/result, not the later submitted action.
- A real gym-produced `external` row is accepted by evidence parsing and included in trusted evidence.
- No client-supplied reward/pass/license/scenario fields are trusted.

Gates:
```bash
npm run build
npm run lint
npm run verify:evidence
npm test
npm run gates
```
