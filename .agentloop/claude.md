# Claude Bridge Output

## Mode
Planning-only pass (per `.agentloop/prompts/claude-desktop-bridge.md` + BRIDGE.md):
read, inspect, run gates, return **evaluation + plan**. **No code changed.**

## Current state (verified)
- `npm run gates` → **GREEN**: build + lint + verify:evidence (40) + **111 tests /
  14 files**. Tree clean (only `AGENTS.md` modified). Codex's two polish layers are
  committed (`be2214d`, `1bb927b`).
- Codex's investor polish verified in-browser:
  - Landing "Why now / Why us", "Pilot package", and readiness-pack disclaimer all
    render. Responsive: mobile 375px **no horizontal overflow**, market panel
    single-column on mobile / two-column on desktop.
  - Results JSON **Copy** + **Download** are native (`navigator.clipboard` +
    `Blob`/`createObjectURL`) — no new deps. Good.
- Server bridge readiness (grounding for the next iteration):
  - `/v1/warehouse` reset/step exists, **server-authoritative** oracle/reward,
    signed episode token carries the action trace, and is tested (hides the oracle
    label, rejects spoofed/extra fields and unknown tasks).
  - `scenario_snapshot` is already a JSON(B) field → **enrichable with NO schema
    change**.
  - `src/environmentPlan.ts` `applyEmbodiment` / `getEmbodimentProfile` are pure and
    already importable server-side (server imports from `src/` today).
  - **Gap:** `server/referenceAgent.ts` has **no warehouse path** — the warehouse env
    is external-policy only; there is no server-owned model-under-test reference for it.

## Core finding
The two halves of the product are **disconnected**:
- The UI **generates** a plan and scores it **client-side** (`buildWarehouseDemoForTasks`)
  with **no persistence**.
- The server **`/v1/warehouse`** scores **canonical static tasks** with persistence,
  but knows nothing about generated plans or embodiment.

Connecting them is exactly Codex's recommended objective. The whole iteration hinges
on one trust-boundary decision (below).

## Trust-boundary analysis (the crux)
- The plan/requirement is **client-supplied descriptive metadata**. Safe to persist
  as a snapshot; it must **never** influence oracle/reward/labels.
- **Embodiment must be a server-trusted ENUM, not raw battery/step numbers.** If the
  client could post `battery`/`maxSteps`, it could weaken a task into a "finish" and
  forge an easier oracle. Instead the server applies
  `applyEmbodiment(canonicalTask, embodiment)` from the enum and **bakes it into the
  signed token**, so every step re-derives the same adjusted task + oracle. Picking an
  embodiment is a legitimate config choice; it cannot move truth beyond the fixed,
  server-owned profiles.
- Domain theming is **display-only**; recorded in the snapshot, never used for scoring.

## Proposed plan (staged; Stage A = no schema change, no spend)

**Stage 0 — design lock (this doc).** Agree the boundary + the persistence target.

**Stage A — connect journey to durable evidence (deterministic, no model spend, no migration):**
1. **Embodiment-aware gym.** Import `applyEmbodiment` + `RobotEmbodiment` into
   `server/env/warehouseGym.ts`. Add `embodiment` (enum, **default `humanoid` =
   identity**, fully backward-compatible) to `WarehouseResetInput` +
   `WarehouseEpisodePayload`; `pickTask` applies it server-side; oracle/reward derive
   from the embodied task; token carries the enum.
2. **Enrich `scenario_snapshot`** with `{ embodiment, domain, planId,
   requirementOutcome (truncated), labelCounts }` — additive to existing JSON, **no
   migration**.
3. **Route validation** (`server/app.ts`): allow-list `embodiment`/`domain` on
   `/v1/warehouse/episodes`, validate against `ROBOT_EMBODIMENTS`/`PHYSICAL_DOMAINS`,
   reject unknown. Domain recorded only, never scored.
4. **Server-owned deterministic warehouse reference path** (mirror
   `/v1/reference-episodes`): runs the **oracle/baseline** policy through the full
   embodied rollout, mints trusted provenance, persists a tamper-evident row. Zero
   spend — this is what lets a generated plan produce **real persisted evidence**.
5. **UI (small):** on results, "Persist this eval to evidence" via the reference path;
   surface the returned record id / digest in the existing `EvidencePanel`.
6. **Tests:** embodiment reset determinism + oracle still hidden; spoof/unknown-embodiment
   rejected; snapshot carries plan metadata; reference warehouse path persists +
   idempotent (first-write-wins).

**Stage B — live model-under-test (GATED: explicit approval + acknowledges model spend):**
7. Nebius as a **multi-step warehouse policy**: per observation, server asks Nebius for
   the next tool action, loops to terminal, mints `nebius` provenance, persists, with
   robust fallback to the deterministic policy on any failure. Real spend + latency +
   prompt design. **Only after Stage A is green and you explicitly approve.**

## Risks / open questions
- **Persistence target:** I recommend **enriching the existing `eval_episodes` row**
  (no schema) for Stage A, not a new table. (Codex listed all three; please confirm.)
- **Backward compat:** default embodiment `humanoid` = identity keeps existing
  `/v1/warehouse` callers + tests unaffected. Confirm acceptable.
- **Domain on server:** validate-and-record (reject unknown) vs accept-anything —
  I recommend validate-and-record.
- **Stage B = spend:** needs explicit approval + a single-episode/spend guard before
  any Nebius warehouse call.
- **Scope guard:** Stage A adds no migrations, no upload parsing, no procedural
  generation, no spend.

## Handoff To Codex
Status: Planning pass complete. Build verified green (111/14); your report + polish
layers verified in-browser and responsive. Identified that the generated journey and
the persisted `/v1/warehouse` env are disconnected, and produced a staged plan to
connect them. No code written.
Needs: Approval of the trust-boundary decision (embodiment = server-trusted enum baked
into the signed token; plan/requirement persisted as descriptive snapshot only) and of
the Stage A scope (no schema change, no spend). A go/no-go on Stage B (live Nebius
warehouse path = model spend).
Files changed: none (planning only). This file (`.agentloop/claude.md`) is the only write.
Gates: `npm run gates` GREEN — build + lint + verify:evidence (40) + 111 tests / 14 files.
Questions:
1. Persistence target for Stage A: enrich existing `eval_episodes` row (my rec) vs new
   table vs local-only export first?
2. OK to extend `/v1/warehouse` reset with an `embodiment` enum (default humanoid =
   identity, backward-compatible) and bake it into the signed token?
3. Build the Stage A server reference path with the **deterministic** policy first
   (zero spend), and hold the Nebius multi-step path (Stage B) for a separate explicit
   approval?
