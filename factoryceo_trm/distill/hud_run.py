"""Run real HUD rollouts against the FactoryCEO-TRM environment.

Needs HUD_API_KEY and the Python 3.12 HUD venv:
    export HUD_API_KEY=$(grep '^HUD_API_KEY=' .env | cut -d= -f2-)
    ./.venv-hud/bin/python distill/hud_run.py            # TRM vs a gateway LLM
    ./.venv-hud/bin/python distill/hud_run.py --agent llm:claude-haiku-4-5

Each produces a graded HUD `Run` (leaderboard-comparable). The TRM agent is the
2,954-param student driving the verifier-gated repair loop; the LLM agent is a
HUD gateway model.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import hud
from hud import LocalRuntime
from hud.agents import create_agent

from distill.hud_app import operate
from distill.hud_trm_agent import make_trm_agent

APP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hud_app.py")


async def rollout(agent, seed: int = 0):
    return await hud.eval.rollout(
        operate(seed=seed), agent,
        runtime=LocalRuntime(path=APP, env="factoryceo-trm"))


async def main(agent_spec: str | None, seed: int = 0):
    if agent_spec and agent_spec.startswith("llm:"):
        run = await rollout(create_agent(agent_spec[4:]), seed)
        print(f"HUD Run | agent={agent_spec} | reward={run.reward}")
    else:
        trm = await rollout(make_trm_agent(), seed)
        llm = await rollout(create_agent("claude-haiku-4-5"), seed)
        print(f"\nHUD leaderboard (same env, same task, graded by the verifier):")
        print(f"  TRM (2,954 params)      reward = {trm.reward:.3f}")
        print(f"  Claude Haiku (gateway)  reward = {llm.reward:.3f}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--agent", default=None, help="llm:<model> for a single gateway run; default = TRM vs LLM")
    ap.add_argument("--seed", type=int, default=0)
    asyncio.run(main(ap.parse_args().agent, ap.parse_args().seed))
