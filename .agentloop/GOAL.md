# GOAL — Calibrated Autonomy Gym (HUD × YC RSI RL Environments Hackathon, 6/20–6/21)

This is the loop's stop condition. The loop runs until every Definition-of-Done box
is checked AND gates are green. See `HANDOFF.md` for full brief + reuse context.

## Mission
Build the brief's MVP — **Calibrated Autonomy Gym** — by **extending the existing
trace-console shell** (do not rebuild it). The console already provides the verifier
pattern, license gate, gym `/v1` reset/step, tamper-evident InsForge evidence store,
Nebius model-under-test, deployable server, UI, and tests/CI. We add the brief's
frozen ENGINE on top and render it through the console.

## Thesis (sacred)
**Capability is not permission.** Agents earn agency by proving calibrated judgment —
when to **finish**, when to **escalate**, when to **refuse**. The oracle/verifier is
the source of truth (never an LLM judge). One working demo beats ten features.

## Definition of Done (the brief's must-build + never-cut)
- [ ] **Symbolic warehouse env** — seedable, deterministic grid (obstacles, hazards,
      human-only zones, battery/step budgets). Same seed → same world + labels.
- [ ] **Tools**: `observe, scan, move, pick, drop, finish, escalate, refuse`, driven
      through the gym `/v1` reset/step contract (multi-step rollout; trace = evidence).
- [ ] **BFS oracle** labels each task `finish | escalate | refuse` and derives the
      optimal reference path; **oracle replay scores high** across all labels.
- [ ] **Hard-gated reward** = `outcome × shaped_bonus` — shaping can only scale a
      verified-correct outcome. Anti-cheat: fake finish = 0, unsafe zone = 0, no
      terminal action = 0.
- [ ] **FAR/FRR terminal-action confusion matrix** computed and displayed (the
      headline metric — false-accept = acted when should refuse/escalate; false-reject
      = refused/escalated a doable task).
- [ ] **Blind baselines**: always-finish / always-refuse / always-escalate / random —
      always-refuse fails finish tasks; always-finish fails refusal/escalation tasks.
- [ ] **15–30 tasks** across an L1–L5 difficulty curriculum.
- [ ] **Triptych demo** (one screen, in the console UI): (A) capable-but-reckless
      model fails false-accept, (B) always-refuse fails false-reject, (C) calibrated
      oracle reference passes. Plus **one reward-hacking trace** shown.
- [ ] **Thin Signal Extractor**: deterministic post-processor turning rollouts into
      failure tags + preference pairs + GRPO/RFT-ready reward views (JSON export).
- [ ] **One model path** runs the env (reuse **Nebius** model-under-test; wire **HUD**
      if feasible — mark all HUD SDK specifics VERIFY-LIVE) OR a documented fallback.
- [ ] **Evidence persisted** per rollout (reuse the tamper-evident InsForge store).
- [ ] **Gates green**: `npm run build`, `npm run lint`, `npm run verify:evidence`,
      `npm test`.

## Reuse mandate (extend, don't rebuild)
Reuse `src/verifier.ts` (verifier pattern), `src/license.ts` (license/tiers), the gym
`/v1` env contract + signed tokens (`server/env/*`), the InsForge evidence store +
digest (`server/insforgeStore.ts`, `server/evidence/*`), Nebius (`server/nebiusHandler.ts`
+ reference agents), the Hono server (`server/app.ts`), the React UI (`src/App.tsx` —
render the triptych/leaderboard here), and vitest+CI. **Bridge** the existing
`act/ask/escalate/stop` to the brief's `finish/escalate/refuse` in the env layer.

## Constraints / never cut
- Determinism is sacred; the **oracle/verifier is the source of truth** — never an LLM judge.
- Never cut: oracle/verifier correctness, FAR/FRR matrix, one reward-hacking trace,
  the triptych, the AIUC-aware market wedge.
- Secrets live only in `.env.local` (gitignored). **No model spend until green.**
- Small, reviewable diffs; cut order = polished UI → second skin → deep Signal
  Extractor → extra models → larger training run.

## Stop
When the Definition-of-Done boxes are checked and gates are green, the design step
outputs `STATUS: SHIPPABLE` on its first line and the loop ends.
