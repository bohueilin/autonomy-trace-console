All gates green. Implementation complete.

---

# Implementation Report — Unify evidence schema (`external` provenance)

## Plan evaluation
The plan was sound, well-scoped, and low-risk. It cleanly separates **request-side** policy modes (`mock | nebius`, unchanged) from **evidence-side** provenance (now includes `external`), so the gym `/v1` path's rows are no longer dropped as malformed. No correctness/security/scope concerns — implemented as specified.

## Files changed
- **`src/types.ts`** — added `EvidencePolicySource = 'mock' | 'nebius' | 'external'` (documented as an evidence-only superset of `AgentSource`). Repointed `TraceProvenance.requestedPolicyMode/actualPolicySource` and `CompactRun.requestedPolicyMode/actualPolicySource` to it. `AgentSource` stays `mock | nebius` (UI mode selector + `AgentDecision.source` untouched).
- **`server/runEpisodeHandler.ts`** — imported `EvidencePolicySource`; repointed `EvidenceItem.requestedPolicyMode/actualPolicySource`; replaced the parser allow-list `POLICY_MODES = ['mock','nebius']` with `EVIDENCE_POLICY_SOURCES: EvidencePolicySource[] = ['mock','nebius','external']` (documented); updated both parser membership checks and the two `parseEvidenceRow` casts. Request coercion in `handleRunEpisode` is **unchanged** — still rejects anything but `mock | nebius`. Dropped the now-unused `AgentSource` import.
- **`scripts/verifyServerEvidence.mjs`** — added checks 36–40: a gym-shaped row (`trace_id: gym-…`, both provenance fields `external`, `model_name: external-agent/reference-v1`, digest recomputed) parses non-null, preserves `external`, is `digestStatus: 'valid'`, is version-compatible and included in both the license set and trusted set when merged, and unknown provenance (`wat`/`rogue`) is still rejected.
- **`server/runEpisodeHandler.test.ts`** (new, optional per plan step 10) — focused Vitest regression: accepts external gym row, still accepts legacy mock/nebius, rejects unknown provenance. No network/InsForge mocking.

## Key decisions
- Chose `EvidencePolicySource` as a distinct named type (not widening `AgentSource`) so the request-side `mock | nebius` contract stays statically enforced — `external` is structurally unselectable for `/api/run-episode`.
- `vapiHandler.ts:68` (`requestedPolicyMode === 'nebius'`) and `App.tsx` `AgentSource` selector compile unchanged — the widening is backward-compatible.
- Added the optional Vitest test in addition to (not instead of) the verify-script checks, to graduate the regression into `npm test` per the GOAL's vitest DoD.

## Gate results — all PASS
- `npm run build` ✅ (tsc -b + vite build)
- `npm run lint` ✅ (clean)
- `npm run verify:evidence` ✅ (40/40 checks, "ALL CHECKS PASSED")
- `npm test` ✅ (6 files, 29 tests, all green)
- `npm run gates` ✅ (full chain green)

## Deferred / open questions for Codex
- **Nothing deferred within scope.** The change is parse/accept-only; producing real gym `external` rows lives in the `/v1` persist path (out of scope here).
- The verify-script `externalRow` reuses the legacy `validRow` body and only flips provenance + `model_name`. A real gym row's `scenario_snapshot`/`actual_policy_input` shape may differ; the parser doesn't validate those fields, so it's fine for now — flagging in case Codex wants a follow-up round to assert gym-row field fidelity end-to-end.
- `model_name` for external rows currently carries a reference id string (`external-agent/reference-v1`). If the gym path stores the external agent identity elsewhere, Codex may want to standardize that column name in a later round.
