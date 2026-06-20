## Review

**Verdict: NEEDS-FIX**

**P0 - Public clients can forge durable `mock` / `nebius` provenance.**  
`server/main.ts:65-67` passes the public reset body straight into `resetEpisode`; `server/env/gym.ts:189-194` signs whatever `agentId` the client supplied; `server/env/gym.ts:152-158` maps exact strings like `nebius-reference` to trusted provenance; and `server/env/gym.ts:425-431` persists that as `requested_policy_mode`, `actual_policy_source`, and `model_name`. With `cors('*')` at `server/main.ts:57-58`, any caller can reset with `agentId: "nebius-reference"`, step any action, and persist tamper-evident evidence falsely claiming Nebius decided. Recommendation: reserve reference-agent IDs. Public `/v1` resets must reject or downgrade reserved IDs to `external`; only a server-owned reference-agent path should be able to mint a signed episode whose provenance becomes `mock` or `nebius`.

**P1 - `/v1` step is not actually a strict `{ action }` contract server-side.**  
The client test only proves the browser helper sends `{ action }` (`src/gymClient.test.ts:68-79`), but the HTTP route merges the entire JSON body into `stepEpisode` (`server/main.ts:74-75`). `StepInput` still accepts `confidence` and `rationale` (`server/env/gym.ts:79-83`) and persists sanitized client values into the digest-covered audit row (`server/env/gym.ts:433-435`). That undercuts the README trust-boundary claim that the client “cannot even send” extra fields (`README.md:360-364`) and misses the design acceptance criterion that the step request body remains exactly `{ action }`. Recommendation: validate the step body at the server boundary and reject unknown keys, or project explicitly to `{ episodeId, action }` before calling `stepEpisode`.

**P1 - Tests enshrine the spoofable provenance path instead of testing the trust boundary.**  
The new provenance tests call `resetEpisode` directly with arbitrary `agentId` values and assert they persist as trusted source labels (`server/env/gym.test.ts:544-565`). That covers mapping logic, but not the public API threat model. Recommendation: add route-level or handler-level tests proving public reset cannot mint trusted `mock-reference` / `nebius-reference` provenance, plus a positive test for the server-owned reference-agent path.

Gates did pass: build/lint/evidence/tests are green in `.agentloop/gates.log:23-67` and `.agentloop/gates.log:120-125`. The coverage is not honest enough for this trust-boundary change.

## Next design

**Objective**  
Close the provenance-forgery hole and make `/v1` step strict at the server boundary while preserving the thesis: model proposes, environment verifies, license gate decides, evidence is tamper-evident.

**Scope**  
Touch only `server/main.ts`, `server/env/gym.ts`, `server/env/gym.test.ts`, targeted client wiring if needed in `src/App.tsx` / `src/gymClient.ts`, and README wording. Do not change verifier, reward, license math, digest field list, or scenario answers.

**Steps**

1. Reserve `mock-reference` and `nebius-reference` as trusted internal identities.
2. Change public `/v1/episodes` handling so client-supplied reserved IDs are rejected or signed as `external`, not trusted provenance.
3. Add a server-owned reference-agent execution path that can mint trusted reference episodes only after the server actually runs that reference path:
   - Mock: reset, decide from reset observation, step.
   - Nebius: reset, call Nebius from visible model view, step only on success.
   - Nebius fallback: discard the Nebius reset, open fresh trusted mock reset, step mock.
4. Stop deriving durable provenance from raw public `agentId`; derive it from a server-controlled signed token field or trusted reset mode.
5. Make `/v1/episodes/:episodeId/step` and `/v1/step` validate body shape. Accept only `action` plus route/body episode ID as appropriate; reject extra client fields.
6. Update README to distinguish public external gym agents from server-owned reference agents.
7. Add tests for:
   - Public reset with `agentId: "nebius-reference"` cannot persist `nebius/nebius`.
   - Trusted server reference path persists `mock/mock` and `nebius/nebius`.
   - Nebius fallback persists only trusted `mock/mock`.
   - Step rejects extra fields like `reward`, `license`, `confidence`, and `rationale`.

**Acceptance criteria**

- A public client cannot forge `mock`, `nebius`, reward, verdict, scenario result, or license evidence.
- Reference-agent provenance is concrete only when minted by server-owned reference execution.
- `/v1` step is server-enforced as `{ action }`, not just client-conventional.
- Existing deterministic verifier/license semantics are unchanged.
- Gates remain green.

**Gates**

```bash
npm run build
npm run lint
npm run verify:evidence
npm test
npm run gates
```
