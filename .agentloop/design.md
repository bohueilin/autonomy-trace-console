## Objective

Unify the evidence schema so `/api/evidence/status` accepts digest-valid gym `/v1` rows with `requested_policy_mode: "external"` and `actual_policy_source: "external"` as trusted evidence.

## Scope

Change only:
- `src/types.ts`
- `server/runEpisodeHandler.ts`
- `scripts/verifyServerEvidence.mjs`
- optionally `server/runEpisodeHandler.test.ts` if you choose Vitest coverage instead of only extending the verification script

Do NOT touch:
- verifier or license scoring semantics
- digest allow-list / canonicalization
- gym replay/idempotency logic in `server/env/gym.ts`
- `/api/run-episode` request policy modes; it should still accept only `mock | nebius`
- UI behavior beyond type fallout required to compile

## Steps

1. In `src/types.ts`, introduce an evidence provenance type that includes `external`, for example `EvidencePolicySource = "mock" | "nebius" | "external"`.
2. Keep `AgentSource = "mock" | "nebius"` for actual agent decisions and the UI mode selector.
3. Update evidence-facing types to use the new provenance type:
   - `TraceProvenance.requestedPolicyMode`
   - `TraceProvenance.actualPolicySource`
   - `CompactRun.requestedPolicyMode`
   - `CompactRun.actualPolicySource`
4. In `server/runEpisodeHandler.ts`, update `EvidenceItem.requestedPolicyMode` and `EvidenceItem.actualPolicySource` to use the evidence provenance type.
5. Replace the parser allow-list currently named `POLICY_MODES = ["mock", "nebius"]` with an evidence-specific allow-list that includes `external`.
6. Keep the legacy `/api/run-episode` `PolicyMode` type and request coercion as `mock | nebius`; `external` must be accepted only when parsing persisted evidence rows.
7. Update `parseEvidenceRow` casts so a row with both provenance fields set to `external` parses successfully, provided all other strict validation and digest checks pass.
8. Extend `scripts/verifyServerEvidence.mjs` with a gym-shaped external row:
   - start from the existing valid row shape
   - set `trace_id` to a `gym-...` id
   - set `requested_policy_mode: "external"`
   - set `actual_policy_source: "external"`
   - set `model_name` to a reference external agent id
   - recompute `audit_row_digest` after those changes
9. Add checks proving:
   - `parseEvidenceRow(externalDigested)` returns a non-null item
   - `requestedPolicyMode` and `actualPolicySource` are both `"external"`
   - `digestStatus` is `"valid"`
   - when merged with other evidence, the external row is version-compatible and included in the license/trusted evidence set
   - unknown provenance values are still rejected
10. If adding Vitest coverage, create `server/runEpisodeHandler.test.ts` for the same parser regression. Keep it focused; do not mock network or InsForge unless needed.

## Acceptance Criteria

- A persisted gym row with `requested_policy_mode: "external"` and `actual_policy_source: "external"` is no longer dropped as malformed by `parseEvidenceRow`.
- Unknown provenance values such as `"wat"` are still rejected.
- `AgentSource` remains `mock | nebius`; `external` is not a selectable `/api/run-episode` policy mode.
- Evidence compact rows can carry `external` provenance without TypeScript errors.
- Existing evidence digest and tamper checks still pass.

## Gates

```bash
npm run build
npm run lint
npm run verify:evidence
npm test
npm run gates
```
est
```
