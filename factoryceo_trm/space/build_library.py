"""Precompute the floor library as STATIC artifacts so the UI needs no live brain.

For each archetype floor: compile a feasible state, build the full episode (raw
plan + verifier errors + repair trace + verified plan), and write a self-contained
run JSON the studio can render offline. Also writes a catalog (library.json).

    python space/build_library.py /path/to/autonomy-trace-console/public/factoryceo
"""

from __future__ import annotations

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from src.generator import load_seeds, amplify_seed, corrupt_plan          # noqa: E402
from src.baselines import greedy                                           # noqa: E402
from src.data_export import build_episode                                  # noqa: E402
from src.repair_loop import repair_loop                                    # noqa: E402
from src.verifier import evaluate                                          # noqa: E402
from src.hud_env import hybrid_reward                                      # noqa: E402
from isaac.plan_to_isaac import plan_to_tasks                              # noqa: E402

LABEL = {"automotive_clips_brackets": "Automotive clips & brackets",
         "consumer_electronics_enclosures": "Electronics enclosures",
         "medical_devices_eval": "Medical devices"}


def main() -> None:
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "results", "library_out")
    libdir = os.path.join(out, "library")
    os.makedirs(libdir, exist_ok=True)
    seeds = load_seeds()
    catalog = []
    for i, s in enumerate(seeds):
        st = amplify_seed(s, variant=i + 1, horizon_days=30, n_jobs=16)
        cand = corrupt_plan(st, greedy(st), seed=i, n_corruptions=6)
        ep = build_episode(st, cand, seed=i, K=60)
        final, _ = repair_loop(st, cand, K=60)
        res = evaluate(st, final)
        run = {
            "episode": ep,
            "isaac_tasks": plan_to_tasks(st, final),
            "naive_isaac_tasks": plan_to_tasks(st, cand),
            "naive_verdict": {"hard_violations": evaluate(st, cand).n_hard},
            "intake": {"industry": s["id"], "n_jobs": len(st.jobs), "source": "library",
                       "summary": LABEL.get(s["id"], s["id"])},
            "reward": hybrid_reward(st, final),
        }
        with open(os.path.join(libdir, f"{s['id']}.json"), "w") as f:
            json.dump(run, f)
        m = res.metrics
        catalog.append({
            "id": s["id"], "label": LABEL.get(s["id"], s["id"]), "industry": s["id"],
            "machines": [mm.id for mm in st.machines], "n_jobs": len(st.jobs),
            "metrics": {"reward": round(res.reward), "hard_violations": res.n_hard,
                        "on_time": round(m["on_time_rate"], 3), "utilization": round(m["utilization"], 3)},
            "verified": res.n_hard == 0,
            "naive_violations": run["naive_verdict"]["hard_violations"],
        })
    with open(os.path.join(out, "library.json"), "w") as f:
        json.dump({"floors": catalog, "count": len(catalog),
                   "note": "pre-built, verified floor archetypes (static)"}, f, indent=2)
    print(f"wrote {len(catalog)} floors -> {out}/library.json + {libdir}/*.json")


if __name__ == "__main__":
    main()
