"""FactoryCEO-TRM as a HUD environment.

HUD (hud.ai, ``hud-python``) packages tools + scenarios into a deployable RL/eval
environment: any ``@env.tool()`` is a callable action, and an ``@env.template()``
async generator *yields a prompt, receives the agent's answer, then yields a
reward in [0,1]*. That reward signal is exactly what you feed GRPO/RFT to train a
smaller specialised model -- the distillation path (large teacher -> small TRM).

This module exposes:
  * ``normalized_reward(state, plan)`` -- verifier reward squashed to [0,1]
    against per-scenario floor (naive plan) and ceiling (greedy), usable with or
    without HUD installed; it's what the tests check.
  * ``build_environment()`` -- the actual HUD env (tools + scenario template),
    built only when ``hud`` is importable.

Run locally once ``pip install hud-python`` and ``hud init`` scaffolding are set:
    hud dev          # local MCP server with hot reload
    # then run a Taskset against an agent and convert rewards -> advantages
"""

from __future__ import annotations

import json

from .schemas import FactoryState, ActionPlan
from .generator import generate_state, messy_prompt
from .baselines import greedy, base_plan
from .verifier import evaluate
from .repair_loop import repair_loop
from .ruler import RulerJudge


def group_relative(rewards: list[float], normalize_std: bool = True) -> list[float]:
    """GRPO advantages from a group of rollout rewards (HUD/OpenPipe ART API).

    advantage_i = (reward_i - mean) / (std + eps)  -- centre on the group mean so
    above-average rollouts get positive advantage, below-average negative. This is
    the per-trajectory signal fed to the optimizer; needs no HUD key (the cloud
    key is only for hosted agent rollouts, telemetry, and the leaderboard)."""
    import statistics
    if not rewards:
        return []
    mean = statistics.fmean(rewards)
    if not normalize_std or len(rewards) < 2:
        return [r - mean for r in rewards]
    sd = statistics.pstdev(rewards)
    return [(r - mean) / (sd + 1e-8) for r in rewards]


def normalized_reward(state: FactoryState, plan: ActionPlan) -> float:
    """Verifier reward -> [0,1], floored at the naive plan, ceiled at greedy.

    Hard-constraint violations dominate the raw reward, so an infeasible plan
    lands near 0 and a clean, profitable, safe plan near 1. This is the scalar a
    HUD agent is trained to maximise."""
    floor = evaluate(state, base_plan(state)).reward
    ceil = evaluate(state, greedy(state)).reward
    r = evaluate(state, plan).reward
    if ceil <= floor:
        return 1.0 if r >= ceil else 0.0
    return max(0.0, min(1.0, (r - floor) / (ceil - floor)))


_JUDGE = RulerJudge()


def hybrid_reward(state: FactoryState, plan: ActionPlan, w: float = 0.3,
                  judge: RulerJudge = _JUDGE) -> dict:
    """Verifier (hard, trusted) blended with a RULER LLM-judge (soft, higher-dim).

    The verifier gates first: an infeasible/unsafe plan scores ~0 on the verifier
    term, so no amount of judge approval can rescue it (anti-reward-hacking). The
    judge only shapes the *soft* quality of otherwise-feasible plans. This is the
    scalar a HUD agent / GRPO loop (e.g. OpenPipe ART) maximises."""
    vr = normalized_reward(state, plan)
    j = judge.score(state, plan)
    blended = round((1 - w) * vr + w * j["score"], 4)
    return {"reward": blended, "verifier": round(vr, 4), "ruler": j["score"],
            "ruler_backend": j["backend"], "ruler_rationale": j["rationale"]}


def scenario_prompt(state: FactoryState) -> str:
    return (
        "You are the autonomous operations brain of a high-mix factory.\n\n"
        f"{messy_prompt(state)}\n\nCanonical state:\n"
        f"{json.dumps(state.model_dump(mode='json'))}\n\n"
        "Return ONE JSON ActionPlan (quote_decisions, procurement, schedule, "
        "quality, customer_messages, safety) that is feasible, profitable, and "
        "safe. Schedule every operation of every job."
    )


def score_answer(state: FactoryState, answer: str, hybrid: bool = True) -> float:
    """Parse an agent's JSON answer and score it; 0 on unparseable output.

    Uses the verifier+RULER hybrid reward by default; set hybrid=False for the
    pure-verifier signal."""
    try:
        start, end = answer.find("{"), answer.rfind("}")
        plan = ActionPlan.model_validate(json.loads(answer[start:end + 1]))
        return hybrid_reward(state, plan)["reward"] if hybrid else normalized_reward(state, plan)
    except Exception:
        return 0.0


def build_environment():
    """Construct the HUD environment. Requires ``hud-python``."""
    from hud import Environment  # raises ImportError if HUD not installed

    env = Environment(name="factoryceo-trm")

    @env.tool()
    async def repair_plan(plan_json: str) -> str:
        """Run the verifier->repair loop on a candidate plan and return the
        repaired plan plus its reward (lets the agent use the TRM loop as a tool)."""
        state = generate_state(seed=0)
        plan = ActionPlan.model_validate(json.loads(plan_json))
        final, _ = repair_loop(state, plan, K=60)
        return json.dumps({"plan": final.model_dump(mode="json"),
                           "reward": normalized_reward(state, final)})

    @env.template()
    async def operate_factory(seed: int = 0, horizon_days: int = 30):
        state = generate_state(seed=seed, horizon_days=horizon_days)
        answer = yield scenario_prompt(state)
        yield score_answer(state, answer)

    return env, operate_factory
