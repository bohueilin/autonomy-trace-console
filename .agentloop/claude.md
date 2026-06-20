# Claude Bridge Output

## Mode
Implementation pass — **Stage A only**, exactly as approved in `.agentloop/codex.md`.
Scope was unambiguous, so I implemented rather than re-planning. No Stage B, no
Nebius/model spend, no migrations, no upload parsing, no procedural generation.

## What I implemented

### 1. `/v1/warehouse` is embodiment-aware (server-trusted enum)
- `WarehouseResetInput` + the **signed** `WarehouseEpisodePayload` now carry
  `embodiment`, `domain`, and optional `planId` / `requirementSummary`.
- Reset applies `applyEmbodiment(canonicalTask, embodiment)` server-side; the oracle
  and reward derive from the **adjusted** task. The token stores the base task id +
  embodiment, so step re-derives identical physics from the **signed token only**
  (never step-body fields). Defaults: `embodiment: humanoid` (identity) +
  `domain: warehouse` → existing callers/tests unchanged.
- `domain`, `planId`, requirement text are **descriptive/provenance only** — never
  touch oracle/reward. `verifyWarehouse` coerces unknown/legacy values to defaults.

### 2. Route validation (`server/app.ts`)
- Reset allow-list extended; `embodiment` validated against `ROBOT_EMBODIMENTS` and
  `domain` against `PHYSICAL_DOMAINS` — unknown values → 400 (not coerced).
- Step still rejects any extra field (so embodiment in the step body → 400).

### 3. Evidence enriched without a migration
- `scenario_snapshot` (already in `DIGEST_FIELDS`) now includes `baseTaskId`,
  adjusted `task`, `embodiment`, `embodimentProfile`, `domain`, `domainTheme`, `plan`
  ({planId, requirementSummary}), and the rollout summary. Tampering with any of it
  breaks the existing digest. **No schema change.**
- Refactored `persistTerminal` into a pure, exported `buildWarehouseAuditRow(ctx,
  rollout)` (digest computed inside) + a thin persist wrapper.

### 4. Deterministic server-owned reference path
- `POST /v1/warehouse/reference-episodes` (exact fields: `taskId`, `domain`,
  `embodiment`, optional `planId`, `requirementSummary`, `runId`). Runs the
  **calibrated oracle** through the embodied task via the same engine and persists
  evidence with **`mock`** provenance (deterministic reference, **no model spend**).
  Agent id `warehouse-oracle-reference`. Public reset still cannot mint this.

### 5. UI bridge (`LicenseResults`)
- "Persist reference evidence" action persists **one representative** oracle episode
  (prefers a finish task, else the first) via `persistWarehouseReference` in
  `serverEpisodeClient.ts`. Shows `saved` / `local only` / `unavailable`; copy is
  explicit that it is a single reference run, **not** the full generated plan. The
  client sends only descriptive context + trusted enums; server computes everything.

### 6. Tests (+10)
- Embodiment re-runs BFS server-side (finish→escalate under `arm`); bare reset stays
  humanoid-identity (backward-compatible).
- `buildWarehouseAuditRow` carries plan/embodiment/domain metadata, sets
  `actual_policy_source: mock`, keeps `scenario_id: warehouse:<baseId>`, and stays
  digest-valid.
- Reference episode runs the oracle, returns a passing terminal result, rejects
  unknown task.
- Route-level: reset applies reduced battery for `arm`; invalid embodiment/domain →
  400; step rejects body metadata; reference route returns terminal evidence; rejects
  unknown task / invalid embodiment / extra fields.

## Verification
- `npm run gates` GREEN: build + lint + verify:evidence (40) + **121 tests / 14
  files** (was 111; +10).
- Browser (Vite preview, no backend running): journey → results renders the new
  Evidence-bridge strip; reference task resolves to a finish task (`wh-l1-01`);
  clicking degrades gracefully to "Evidence server unavailable" with **no console
  errors**. A live `saved` row requires the Hono server (`npm run server`, which has
  InsForge creds in `.env.local`); I did **not** start it to avoid a live InsForge
  write during verification — the full server/persistence path is covered by the new
  tests (reference route returns terminal evidence; audit row digest-valid).

## Handoff To Codex
Status: Stage A implemented and green. `/v1/warehouse` is embodiment-aware with a
server-trusted enum baked into the signed token; plan/domain/requirement are
descriptive-only; evidence enriched in `scenario_snapshot` with no migration;
deterministic `/v1/warehouse/reference-episodes` added; UI persists one representative
reference episode. No Stage B, no spend, no schema.
Needs: Review of (a) the `scenario_snapshot` enrichment shape (is it what the future
Signal Extractor / model path will want?), and (b) the reference-route idempotency
choice below.
Files changed:
- `server/env/warehouseGym.ts` (embodiment-aware reset/step, signed eval context,
  exported `buildWarehouseAuditRow`, `runWarehouseReferenceEpisode`)
- `server/app.ts` (enum validation on reset; `POST /v1/warehouse/reference-episodes`)
- `src/serverEpisodeClient.ts` (`persistWarehouseReference`)
- `src/components/LicenseResults.tsx` (persist action + status)
- `src/App.css` (`.persist-strip` styles)
- `server/env/warehouseGym.test.ts`, `server/app.test.ts` (+10 tests)
- `.agentloop/claude.md` (this report)
Gates: `npm run gates` GREEN — build + lint + verify:evidence (40) + 121 tests / 14 files.
Questions:
1. Reference route uses a fresh nonce per call, so repeated clicks create distinct
   evidence rows (each is a real, separate episode). Acceptable, or should it be
   idempotent per `(planId, taskId, embodiment)` to avoid duplicate rows on repeated
   clicks?
2. Audit `domain` column stays `'robotics'`; the **physical** domain lives in
   `scenario_snapshot.domain`. Keep that split, or surface physical domain at top level
   (would touch DIGEST scope / future schema)?
3. Should the UI offer a "persist all plan tasks" batch later, or is one representative
   reference episode the intended ceiling for this layer?
