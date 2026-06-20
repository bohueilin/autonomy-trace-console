Implemented exactly as specified in `design.md`. The plan was sound — tightening `/v1` body validation without touching verifier/license/digest semantics — so no objection.

## Implementation report

### Files changed
- **`server/app.ts`** — Added a strict `/v1` body parser and applied it to all four strict routes.
- **`server/referenceAgent.ts`** — Tightened the trusted runner's input type to the validated boundary.
- **`server/app.test.ts`** — Added focused boundary tests.
- **`README.md`** — Reconciled the three stale endpoint descriptions.

### Key decisions
- **`strictJsonObject(c)`** returns a discriminated `{ ok: true; body } | { ok: false; error }` that distinguishes malformed JSON (parse throws), arrays (`Array.isArray`), and non-object/`null` from valid objects. Added a small `badRequest(c, error)` helper so every `/v1` rejection emits the uniform `{ ok:false, code:"bad_request", error }` at HTTP 400. The permissive `jsonBody()` is **untouched** and still serves the legacy `/api/*` routes, exactly as scoped.
- **`POST /v1/reference-episodes`** now enforces, in order: strict object → exact keys `{scenarioId, mode}` → `scenarioId` non-empty string → `mode` exactly `"mock"|"nebius"`. A missing/mistyped/blank/array/malformed body can no longer mint a random trusted reference scenario.
- **`POST /v1/episodes`** (public) keeps random-scenario behavior when `scenarioId` is omitted, but rejects a *present* `scenarioId` that isn't a non-empty string and a *present* non-string `agentId`. Empty `agentId` still defaults to `anonymous` (unchanged gym behavior).
- **Both step routes** keep exact-key enforcement and add `action` (and body-form `episodeId`) non-empty-string checks at the HTTP boundary, before reaching `stepEpisode`.
- **`referenceAgent.ts`**: `runReferenceEpisode` input is now `{ scenarioId: string; mode: ReferenceMode }`; removed the runtime `mode` guard and the non-string→`undefined` coercion (the route validates first). `runMockEpisode`'s param tightened to `scenarioId: string`. Unknown scenarios still fail closed via `resetReferenceEpisode`/`pickScenario`. `server/env/gym.ts` was deliberately not touched (out of scope); `resetReferenceEpisode` keeps its existing `string | undefined` signature.
- **README**: demo-script step 4 and the canonical-path blockquote now say the primary UI posts `{ scenarioId, mode }` to `POST /v1/reference-episodes`, with public `/v1/episodes` reset/step (`{scenarioId, agentId}` → `{action}`) called out as the external-agent path. The "Verifying the audit semantics" line was labeled as the **legacy `/api/run-episode`** path — that script (`verifyServerEvidence.mjs`) genuinely exercises `handleRunEpisode({ scenarioId, policyMode })`, so the field name is correct; the fix removes the ambiguity that it might describe `/v1`.

### Gate results — all pass
- `npm run build` — ✅ (tsc + vite)
- `npm run lint` — ✅ (eslint, clean)
- `npm run verify:evidence` — ✅ (40/40 checks)
- `npm test` — ✅ (8 files, **74** tests, up from 66 — 8 new boundary tests)
- `npm run gates` — ✅ (full chain)

### Deferred / out of scope (for Codex)
- **Legacy `/api/*` routes** still use the permissive `jsonBody()` per the plan ("may keep the old permissive behavior for this round"). If a later round wants uniform strictness, `/api/run-episode`, `/api/nebius-action`, and `/api/vapi/tools` could adopt `strictJsonObject` too.
- `resetReferenceEpisode` in `gym.ts` retains `scenarioId?: string | undefined`. Since the only caller now always passes a validated non-empty string, its signature could be tightened to `string` in a future gym-scoped round — left untouched here to respect the file scope.

### Open questions
- None blocking. The `badRequest`/`strictJsonObject` helpers are currently `/v1`-local; if legacy routes adopt strict parsing later, consider promoting them to a shared module.
