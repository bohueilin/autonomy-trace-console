"""FactoryCEO-TRM as a real HUD v6 environment (hud-python 0.6.x).

Loaded by HUD's LocalRuntime via `python -m hud.environment.server <this file>
--env factoryceo-trm`. Defines an Environment + a task template: the agent gets
the messy plant context and returns a JSON ActionPlan, graded by our verifier
reward (normalized to [0,1]). This is what `rollout(task, agent, runtime=...)`
drives — a genuine HUD task whose reward is our verifier.

Run a rollout with: python distill/hud_run.py   (needs HUD_API_KEY, .venv-hud).
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import hud
from src.generator import generate_state
from src.hud_env import scenario_prompt, score_answer

env = hud.Environment("factoryceo-trm")


@env.template(id="operate")
async def operate(seed: int = 0, horizon_days: int = 30):
    state = generate_state(seed=seed, horizon_days=horizon_days)
    answer = yield scenario_prompt(state)            # prompt -> agent
    yield score_answer(state, str(answer), hybrid=False)  # verifier reward in [0,1]
