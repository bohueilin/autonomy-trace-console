# Codex Bridge Output

## Status

Phase 1 + Phase 2 are implemented and reviewed. Codex added two product polish
layers after Claude's build:

1. A deterministic Physical AI License Report model and results-page report panel/export preview.
2. Investor/judge-ready polish: Why now / Why us, Pilot package, readiness-pack disclaimer, rescaled reference-readiness wording, and native report JSON copy/download.

Current gates: `npm run gates` is green.

Latest test count observed by Codex: 111 tests across 14 files.

## Bridge Instructions For Claude

Read:

- `.agentloop/BRIDGE.md`
- `.agentloop/GOAL.md`
- `.agentloop/PROTOCOL.md`
- `.agentloop/codex.md`

Write your latest output to:

- `.agentloop/claude.md`

End every update with:

```md
## Handoff To Codex
Status:
Needs:
Files changed:
Gates:
Questions:
```

## What Is Now Built

- Product journey: `landing -> intake -> preview -> results -> showcase`.
- Outcome requirement, domain selector, embodiment selector, and upload placeholders.
- Deterministic environment planner in `src/environmentPlan.ts`.
- Generated environment preview with oracle labels/assumptions.
- Generated results using the warehouse demo engine scoped to plan tasks.
- Deterministic report artifact in `src/licenseReport.ts`.
- Results-page reference-readiness decision, operating envelope, pilot next steps, disclaimer, and JSON report preview/copy/download.
- Desktop bridge files in `.agentloop/BRIDGE.md`, `.agentloop/claude.md`, `.agentloop/codex.md`, and `.agentloop/prompts/claude-desktop-bridge.md`.

## Non-Negotiables

- Determinism is sacred.
- Oracle/verifier is source of truth.
- No LLM judge.
- No model/API spend until gates are green.
- Do not touch secrets, migrations, InsForge schema, or Nebius calls.
- Keep diffs focused and reviewable.

## Recommended Next Iteration

Do not start this until the user asks Claude to continue.

Objective: connect the generated eval journey to durable evidence or a model-under-test path without changing trust boundaries.

Recommended scope:

1. Plan persistence design:
   - Decide whether generated EnvironmentPlan snapshots should be persisted in the existing `eval_episodes` audit row, a new table, or a local-only export first.
   - Do not add schema until Codex/user approves the trust boundary.

2. Model-under-test bridge:
   - Design how Nebius/external policies should consume a generated plan task without letting the client forge oracle labels or rewards.
   - Prefer reusing `/v1/warehouse` signed rollout state.

3. Visual review:
   - Check landing/results desktop and mobile if browser tooling is available.

Avoid:

- No real upload parsing yet.
- No InsForge schema changes without explicit approval.
- No live model spend until gates are green and the model path is explicitly approved.
- No procedural grid generation yet.

Gates:

- `npm run gates`

Report back in `.agentloop/claude.md`.
