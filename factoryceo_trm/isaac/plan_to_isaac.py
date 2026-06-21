"""Bridge: verified ActionPlan -> humanoid task queue for NVIDIA Isaac Sim/Lab.

The brain decides and the verifier gates; this turns the *gated* plan into the
per-robot task list a humanoid controller executes on the simulated factory
floor. Each robot operator's scheduled operations become timed manipulation
tasks (mold / cnc / deburr at a given machine). We deliberately emit only the
verifier-approved plan -- nothing reaches the simulator until hard violations
are zero.

This script is pure-Python and runs anywhere (it just produces JSON). Actually
*executing* the tasks needs Isaac Sim / Isaac Lab on a GPU box -- see
``factory_humanoid_task.py`` and isaac/README.md.
"""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.schemas import FactoryState, ActionPlan          # noqa: E402
from src.verifier import evaluate                          # noqa: E402

# crude machine -> floor coordinate map (metres) for the sim layout
MACHINE_XY = {"M1": [0.0, 0.0], "M2": [2.0, 0.0], "M3": [0.0, 2.0], "M4": [2.0, 2.0]}
SKILL_TASK = {"mold": "pick_place_mold", "cnc": "tend_cnc", "deburr": "deburr_part"}


def plan_to_tasks(state: FactoryState, plan: ActionPlan) -> dict:
    res = evaluate(state, plan)
    robots = {o.id for o in state.operators if o.type.value == "robot"}
    queues: dict[str, list] = {}
    for a in sorted(plan.schedule, key=lambda x: x.start):
        op = state.operation(a.job_id, a.operation_id)
        if op is None:
            continue
        cap = op.capability
        queues.setdefault(a.operator_id, []).append({
            "job": a.job_id, "operation": a.operation_id,
            "task": SKILL_TASK.get(cap, cap),
            "machine": a.machine_id, "machine_xy": MACHINE_XY.get(a.machine_id, [0, 0]),
            "start_hr": a.start, "end_hr": a.end,
            "embodiment": "humanoid" if a.operator_id in robots else "human",
        })
    safety = [{"target": d.target_id, "control": d.action.value} for d in plan.safety]
    return {
        "meta": {
            "verified": res.n_hard == 0,
            "hard_violations": res.n_hard,
            "safety_incidents": res.metrics["safety_incidents"],
            "horizon_hours": state.horizon_days * 24,
            "machines": MACHINE_XY,
        },
        "safety_controls": safety,
        "robot_queues": {oid: q for oid, q in queues.items() if oid in robots},
        "all_queues": queues,
    }


if __name__ == "__main__":
    # build tasks from the demo episode's final (repaired) plan
    from src.generator import generate_state, corrupt_plan
    from src.baselines import greedy
    from src.repair_loop import repair_loop

    s = generate_state(seed=0, horizon_days=30)
    final, _ = repair_loop(s, corrupt_plan(s, greedy(s), seed=0, n_corruptions=6), K=60)
    tasks = plan_to_tasks(s, final)
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "results", "isaac_tasks.json")
    with open(out, "w") as f:
        json.dump(tasks, f, indent=2)
    rq = tasks["robot_queues"]
    print(f"verified={tasks['meta']['verified']} | "
          f"robots={list(rq)} | humanoid tasks="
          f"{sum(len(v) for v in rq.values())} -> wrote results/isaac_tasks.json")
