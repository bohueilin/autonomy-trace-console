## Review

**Verdict: NEEDS-FIX**

**P0:** None.

**P1:** None.

**P2 - README still conflates the primary reference path with public `/v1/episodes`.**  
`README.md:37-41` says the canonical path is `POST /v1/episodes` reset, then “the reference agent” proposes, then `/v1/episodes/:episodeId/step`. That is now inaccurate for the primary UI/reference-agent flow: later docs correctly say primary UI uses server-owned `POST /v1/reference-episodes` and external agents use public reset/step (`README.md:243-250`, `README.md:343-350`). Recommendation: update the top summary to mirror the later trust-boundary wording so the README consistently distinguishes server-owned reference execution from public external-agent reset/step.

**P2 - Non-object body rejection is implemented but not honestly covered.**  
The design required `/v1` public and step routes to reject non-object JSON bodies (`.agentloop/design.md:44-53`, `.agentloop/design.md:76`). The parser does reject primitives/null (`server/app.ts:72-75`), but the new route tests cover arrays and malformed JSON, not primitive/non-object bodies (`server/app.test.ts:63-71`, `server/app.test.ts:141-145`, `server/app.test.ts:217-227`). Recommendation: add a focused primitive/null body test for at least one route using the shared strict parser, or explicitly cover reference/public/step if you want route-level confidence.

Gates are green: build/lint/evidence/tests all ran under `npm run gates`, evidence passed 40/40, Vitest passed 8 files / 74 tests, and `GATES: PASS` is present (`.agentloop/gates.log:2-3`, `.agentloop/gates.log:67`, `.agentloop/gates.log:121-126`). The application behavior matches the trust-boundary thesis; the remaining issue is documentation/test honesty against the stated acceptance criteria.

## Next design

**Objective**  
Close the remaining documentation and test honesty gaps from the strict `/v1` body-validation round, without changing verifier/license/digest or gym semantics.

**Scope**  
Touch only:
- `README.md`
- `server/app.test.ts`

**Steps**
1. Update the top README “canonical episode path” summary so it says:
   - Primary UI/reference runs use server-owned `POST /v1/reference-episodes` with `{ scenarioId, mode }`.
   - Public `/v1/episodes` reset/step is for external agents.
   - Both paths still use the environment as verifier/license authority.
2. Add focused strict-parser tests for non-object JSON bodies:
   - `POST /v1/reference-episodes` rejects `null` or a primitive.
   - `POST /v1/episodes` rejects `null` or a primitive.
   - At least one step route rejects `null` or a primitive.
3. Keep existing malformed JSON, array, exact-key, and valid mock reference tests intact.

**Acceptance criteria**
- README has no top-level wording implying the browser mints reference-agent provenance through public `/v1/episodes`.
- Tests cover malformed JSON, arrays, and primitive/non-object JSON bodies for strict `/v1` validation.
- No production code changes unless a test exposes an actual defect.
- Deterministic verifier/license/digest behavior is unchanged.

**Gates**
```bash
npm run build
npm run lint
npm run verify:evidence
npm test
npm run gates
```
