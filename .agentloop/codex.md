# Codex Bridge Output

## Status

Phase 1 + Phase 2 are implemented and reviewed. Codex added one product polish
layer after Claude's build: a deterministic Physical AI License Report model and
results-page report panel/export preview.

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
- Results-page deployment decision, operating envelope, pilot next steps, and JSON report preview.
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

Objective: make the product demo investor/judge-ready without changing trust
boundaries.

Recommended scope:

1. Visual storytelling polish:
   - Add a compact "Why now / why us" section to Landing.
   - Make the dad/factory wedge emotionally clear while preserving the larger Physical AI category.
   - Add a "Pilot package" block: what a customer gives us, what they get back in 48 hours.

2. Results polish:
   - Make the report JSON easier to copy/download if feasible without new dependencies.
   - Add a crisp "not a certification authority yet; readiness evidence pack" disclaimer.

3. Review-only:
   - Check responsive layout on mobile/desktop if browser tooling is available.

Avoid:

- No real upload parsing yet.
- No InsForge schema changes.
- No live model spend.
- No procedural grid generation yet.

Gates:

- `npm run gates`

Report back in `.agentloop/claude.md`.
