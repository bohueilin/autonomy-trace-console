## Objective

Tighten `/v1` runtime body validation for the GOAL “Gym is canonical” / “One evidence schema” checkboxes so trusted reference provenance cannot be minted from malformed or mistyped requests.

## Scope

Change only:
- `server/app.ts`
- `server/referenceAgent.ts`
- `server/app.test.ts`
- `README.md`

Do NOT touch verifier semantics, reward/license math, digest fields, episode token signing, InsForge store helpers, scenario contents, Vite config, UI components, or legacy `/api/run-episode` behavior.

## Steps

1. In `server/app.ts`, replace the permissive `jsonBody()` behavior for strict `/v1` routes with a small runtime parser that can distinguish:
   - malformed JSON
   - non-object JSON
   - array bodies
   - valid JSON object bodies

2. Apply that strict parser to:
   - `POST /v1/episodes`
   - `POST /v1/episodes/:episodeId/step`
   - `POST /v1/step`
   - `POST /v1/reference-episodes`

   Legacy `/api/*` routes may keep the old permissive behavior for this round.

3. For `POST /v1/reference-episodes`, enforce exactly:
   - body keys: `scenarioId`, `mode`
   - `scenarioId`: present, string, trimmed non-empty
   - `mode`: exactly `"mock"` or `"nebius"`

   Reject failures with HTTP `400` and `{ ok:false, code:"bad_request", error:string }`.

4. In `server/referenceAgent.ts`, make the trusted runner’s input type reflect the stricter boundary:
   - accept `scenarioId: string`
   - accept `mode: ReferenceMode`
   - remove the current non-string-to-`undefined` conversion
   - keep unknown scenario handling fail-closed through `resetReferenceEpisode`

5. For public `/v1/episodes`, keep existing random-scenario behavior if `scenarioId` is omitted, but reject invalid field types when present:
   - `scenarioId` present but not string -> `400`
   - `scenarioId` present as empty/blank string -> `400`
   - `agentId` present but not string -> `400`
   - malformed JSON / array / non-object -> `400`

6. For both step routes, keep exact-key enforcement and add type validation:
   - path-form body must be exactly `{ action }`, with `action` a non-empty string
   - body-form body must be exactly `{ episodeId, action }`, both non-empty strings
   - malformed JSON / array / non-object -> `400`

7. Add focused tests in `server/app.test.ts`:
   - `/v1/reference-episodes` rejects missing `scenarioId`
   - rejects non-string `scenarioId`
   - rejects empty/blank `scenarioId`
   - rejects array body
   - rejects malformed JSON
   - still accepts valid `{ scenarioId:"com-1", mode:"mock" }`
   - public `/v1/episodes` still accepts omitted `scenarioId` for random external reset
   - public `/v1/episodes` rejects non-string or blank `scenarioId`
   - step routes reject non-string/blank `action`

8. Update stale README text that still says the primary UI browser posts `{ scenarioId, agentId }` to `/v1/episodes` for reference gym runs:
   - Demo script step 4 should say the primary UI posts `{ scenarioId, mode }` to `POST /v1/reference-episodes`; public `/v1/episodes` reset/step is for external agents.
   - “Server-owned episodes & InsForge evidence store” canonical path text should say the primary UI uses `POST /v1/reference-episodes`; external agents use public reset/step.
   - “Verifying the audit semantics” should not say only `{ scenarioId, policyMode }` if it is describing `/v1`; use the current `{ scenarioId, mode }` reference endpoint wording.

## Acceptance criteria

- `POST /v1/reference-episodes` cannot run a random scenario when `scenarioId` is missing, mistyped, blank, malformed, or in an array body.
- Valid reference requests still run end-to-end for mock mode.
- Public external `/v1/episodes` keeps its intentional random-scenario option when `scenarioId` is omitted.
- Public and step routes reject malformed JSON, arrays, non-object bodies, invalid field types, and blank required strings.
- README consistently distinguishes server-owned `POST /v1/reference-episodes` from public external `/v1/episodes` reset/step.
- No deterministic verifier/license behavior changes.

## Gates

```bash
npm run build
npm run lint
npm run verify:evidence
npm test
npm run gates
```
