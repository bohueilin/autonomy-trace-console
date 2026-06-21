"""A custom HUD Agent backed by the TRM repair controller.

Makes the 2,954-param TRM appear as a real HUD `Run` — leaderboard-comparable to
the gateway LLMs, graded by the same verifier reward. We subclass the gateway
agent (which already owns the env control channel) and override `get_response`
to return the TRM-controlled plan instead of calling the LLM — so the TRM's
answer flows to the env grader through HUD's normal machinery, at no token cost.

Runs in .venv-hud (Python 3.12, with torch). Driven by distill/hud_run.py.
"""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hud.agents import create_agent
from hud.agents.types import AgentStep

from src.schemas import FactoryState
from src.baselines import base_plan
from src.repair_loop import repair_loop
from src.trm_student import LearnedRepairModel


def _prompt_text(state) -> str:
    parts = []
    for m in state.messages:
        c = m.get("content") if isinstance(m, dict) else getattr(m, "content", None)
        if isinstance(c, str):
            parts.append(c)
        elif isinstance(c, list):
            for b in c:
                t = b.get("text") if isinstance(b, dict) else getattr(b, "text", None)
                if t:
                    parts.append(t)
    return "\n".join(parts)


def make_trm_agent(model: str = "claude-haiku-4-5"):
    """Gateway agent with its brain swapped for the TRM controller (no LLM call)."""
    base = create_agent(model)
    trm = LearnedRepairModel()

    class TRMAgent(type(base)):
        async def get_response(self, state, *, system_prompt=None, citations_enabled=False):
            text = _prompt_text(state)
            tail = text.split("Canonical state:")[-1]
            st = FactoryState.model_validate(
                json.loads(tail[tail.find("{"): tail.rfind("}") + 1]))
            plan, _ = repair_loop(st, base_plan(st), K=60, op_selector=trm.pick_op)
            return AgentStep(source="agent", content=plan.model_dump_json(), done=True)

    base.__class__ = TRMAgent
    return base
