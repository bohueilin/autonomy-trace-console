## Review

**Verdict: ACCEPT for this round's change.** The primary single-episode UI path now uses `/v1` reset/step, sends only `{ action }` on step, and gates pass. Do not mark the broader GOAL done.

**P1 - Durable provenance is still not authoritative for mock vs Nebius fallback.**  
`src/App.tsx:94` stamps the episode token as `nebius-reference` before the Nebius call succeeds; on failure `src/App.tsx:105-107` falls back to mock, while `src/App.tsx:116-120` only records that fallback in browser state. The persisted gym row still stores generic external provenance and `model_name: payload.agentId` at `server/env/gym.ts:404-410`, so evidence can claim `nebius-reference` even when the action came from mock. Recommendation: next round should make gym evidence preserve requested vs actual source without trusting client-verdict fields. The cleanest small fix is: on Nebius failure, discard the first reset and open a new `/v1` episode with `agentId: mock-reference` before stepping, or add a server-validated provenance mechanism that still keeps step reward/verdict/license untrusted.

**P1 - The visible license chip is still browser-computed, not the environment license.**  
`src/App.tsx:41` computes `license` from the React `traces` list, and `src/App.tsx:288-290` renders that as the main license summary beside the evidence panel. That means a mixed client list, local 9-episode eval, or browser mutation can drive the headline license UI while the server-authoritative license is only secondary inside `EvidencePanel` at `src/components/EvidencePanel.tsx:126-134`. This does not forge persisted evidence, but it weakens the thesis presentation: “license gate decides” should point at server/env evidence for gym runs. Recommendation: introduce a distinct authoritative license state from `/v1` step or `/api/evidence/status`, and label the browser eval license as demo-only.

**P1 - Mock reference agent does not actually act from the reset observation.**  
The design required the selected reference agent to act from the returned observation (`.agentloop/design.md:34-38`). Nebius does that via `observationToModelView(reset.observation)` at `src/App.tsx:101-104`, but mock and Nebius fallback still use the bundled local scenario at `src/App.tsx:106` and `src/App.tsx:110`. `toMockView` omits hidden fields, so this is not a direct answer leak, but it couples the policy to the client scenario registry instead of the environment observation. Recommendation: add a mock proposer that consumes the gym observation, or explicitly extend the reset observation with a non-hidden mock feature if the mock policy needs it.

**P2 - Tests prove the transport body, not the UI acceptance criterion.**  
`src/gymClient.test.ts:49-78` covers reset/step client bodies and `ok:false`, which is useful. It does not test that clicking the primary button makes exactly one `/v1/episodes` call and one `/v1/episodes/:id/step` call, nor that `/api/run-episode` is absent from the primary flow. Recommendation: add a small App-level test with mocked `fetch` to cover the primary button path and fallback path.

**Gates:** `GATES: PASS` is present in `.agentloop/gates.log:125`; Vitest reports 7 files / 43 tests passed at `.agentloop/gates.log:120-123`.

## Next Design

**Objective**  
Make gym-run provenance and license presentation match the thesis: the environment’s durable evidence is the source of truth for policy attribution and license state.

**Scope**  
Touch only `src/App.tsx`, `src/gymClient.ts`, `src/types.ts`, focused tests, and README copy unless a minimal server change is required for authoritative provenance. Do not change verifier/reward/license semantics.

**Steps**  
1. Fix fallback attribution: if Nebius action proposal fails after reset, open a fresh gym episode with `agentId: mock-reference` and step that episode, so persisted evidence no longer labels a mock action as `nebius-reference`.
2. Split UI license state into demo/client license vs authoritative gym/server license. For the primary gym path, render the `/v1` step license or refreshed evidence license as the authoritative license.
3. Keep `Run 9-Episode Eval` clearly demo-only and prevent it from overwriting the authoritative license display.
4. Make mock proposal consume the reset observation, or document and type a deliberate mock-only visible feature returned by reset.
5. Add App-level tests for primary button transport: exactly one reset and one step on success, no `/api/run-episode`, fallback opens/steps with correct mock attribution.
6. Update README/demo script to distinguish demo license from authoritative server/gym license.

**Acceptance Criteria**  
- A Nebius failure does not persist or display the stepped episode as `nebius-reference`.
- The main license shown for gym runs comes from `/v1` step or server evidence, not recomputed browser trace state.
- Mock proposal is based on the gym reset observation or an explicitly documented observation field.
- Primary button test proves one reset + one step and no `/api/run-episode`.
- Existing evidence digest/fail-closed tests remain green.

**Gates**  
`npm run build`  
`npm run lint`  
`npm run verify:evidence`  
`npm test`  
`npm run gates`
