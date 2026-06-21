"""The hosted floor library: a richer catalog of manufacturing-floor archetypes.

Each archetype amplifies a seed industry (or a generic job shop) at a given scale
and horizon, with a feasibility retry so every hosted floor compiles to a
0-violation plan. Shared by the live /library endpoint and the static precompute
(space/build_library.py) so they stay in sync.
"""

from __future__ import annotations

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from src.generator import load_seeds, amplify_seed, generate_state, corrupt_plan  # noqa: E402
from src.baselines import greedy                                                  # noqa: E402
from src.data_export import build_episode                                         # noqa: E402
from src.repair_loop import repair_loop                                           # noqa: E402
from src.verifier import evaluate                                                 # noqa: E402
from src.hud_env import hybrid_reward                                             # noqa: E402
from src.intake import _feasible                                                  # noqa: E402
from isaac.plan_to_isaac import plan_to_tasks                                     # noqa: E402

ARCHETYPES = [
    {"id": "auto_std",   "label": "Automotive · standard line",   "seed": "automotive_clips_brackets",      "n_jobs": 16, "horizon": 30},
    {"id": "auto_rush",  "label": "Automotive · high-mix rush",   "seed": "automotive_clips_brackets",      "n_jobs": 26, "horizon": 21},
    {"id": "elec_enc",   "label": "Electronics · enclosures",     "seed": "consumer_electronics_enclosures", "n_jobs": 16, "horizon": 30},
    {"id": "elec_pcb",   "label": "Electronics · PCB ramp",       "seed": "consumer_electronics_enclosures", "n_jobs": 30, "horizon": 45},
    {"id": "med_dev",    "label": "Medical · devices",            "seed": "medical_devices_eval",            "n_jobs": 14, "horizon": 30},
    {"id": "med_clean",  "label": "Medical · clean-room batch",   "seed": "medical_devices_eval",            "n_jobs": 20, "horizon": 30},
    {"id": "gen_job",    "label": "General · job shop",           "seed": None,                              "n_jobs": 24, "horizon": 45},
    {"id": "gen_stress", "label": "General · long-horizon",       "seed": None,                              "n_jobs": 34, "horizon": 60},
]


def _seed_by_id(sid: str | None):
    if not sid:
        return None
    return next((s for s in load_seeds() if s["id"] == sid), None)


def feasible_state(arch: dict, base: int = 1):
    """A feasible state for the archetype (retry variants until greedy+repair = 0)."""
    seed = _seed_by_id(arch["seed"])
    for v in range(10):
        try:
            st = (amplify_seed(seed, variant=base + v, horizon_days=arch["horizon"], n_jobs=arch["n_jobs"])
                  if seed else generate_state(seed=base + v, horizon_days=arch["horizon"], n_jobs=arch["n_jobs"]))
        except Exception:
            st = generate_state(seed=base + v, horizon_days=arch["horizon"], n_jobs=min(arch["n_jobs"], 30))
        if _feasible(st):
            return st
    return st


def build_run(arch: dict, base: int = 1) -> dict:
    st = feasible_state(arch, base)
    cand = corrupt_plan(st, greedy(st), seed=base, n_corruptions=6)
    ep = build_episode(st, cand, seed=base, K=60)
    final, _ = repair_loop(st, cand, K=60)
    res = evaluate(st, final)
    m = res.metrics
    naive_hard = evaluate(st, cand).n_hard
    catalog = {
        "id": arch["id"], "label": arch["label"], "industry": arch["seed"] or "general",
        "machines": [mm.id for mm in st.machines], "n_jobs": len(st.jobs),
        "horizon_days": arch["horizon"],
        "metrics": {"reward": round(res.reward), "hard_violations": res.n_hard,
                    "on_time": round(m["on_time_rate"], 3), "utilization": round(m["utilization"], 3)},
        "verified": res.n_hard == 0, "naive_violations": naive_hard,
    }
    return {
        "episode": ep,
        "isaac_tasks": plan_to_tasks(st, final),
        "naive_isaac_tasks": plan_to_tasks(st, cand),
        "naive_verdict": {"hard_violations": naive_hard},
        "intake": {"industry": arch["seed"] or "general", "n_jobs": len(st.jobs),
                   "source": "library", "summary": arch["label"]},
        "reward": hybrid_reward(st, final),
        "_catalog": catalog,
    }


def build_catalog() -> list[dict]:
    out = []
    for i, arch in enumerate(ARCHETYPES):
        try:
            out.append(build_run(arch, base=i + 1)["_catalog"])
        except Exception:
            continue
    return out
