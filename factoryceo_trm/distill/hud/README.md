# FactoryCEO HUD environment (worldsim-template-style)

A HUD environment for the factory-ops brain, structured after hud-evals/
worldsim-template: a registered **Taskset** with **partial-credit scoring from
the (verifier) sim state**, reference agents, and an eval runner.

```
tasks.py    long-horizon Taskset (14-60 day scenarios) + partial_credit() breakdown
agents.py   reference agents: naive (no repair) / greedy / trm (verifier-gated)
eval.py     offline runner: reset -> drive -> grade, per-task breakdown + leaderboard
```

## Run it

**Offline (no HUD key, no credits)** — grading is our deterministic verifier:

```bash
python distill/hud/eval.py            # all agents x all tasks
python distill/hud/eval.py --agent trm
```

Example leaderboard (mean partial credit): `trm 1.000 · greedy 0.798 · naive 0.302`
(naive leaves 16-28 hard violations on the long-horizon tasks; the verifier-gated
TRM is feasible everywhere).

**Real HUD cloud rollout** (graded HUD Runs, gateway LLM vs the TRM agent) — needs
`HUD_API_KEY` and the 3.12 venv, and spends HUD credits:

```bash
./.venv-hud/bin/python distill/hud_run.py            # TRM vs Claude Haiku, same env
```

## Is HUD in the prod request path?
No. The live brain (`api.py`) calls only the pure reward funcs
(`hud_env.hybrid_reward`/`normalized_reward`). The HUD **environment + rollouts**
are this offline eval/training layer — `build_environment` (`distill/hud_app.py`)
+ the cloud runner — not invoked per request. The same Taskset + verifier reward
back both, so the offline leaderboard and a HUD cloud Run measure the same thing.
