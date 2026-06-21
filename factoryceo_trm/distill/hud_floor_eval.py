"""Measured per-floor HUD rollouts for ShiftBench Staer fixtures.

The fixture panels in the UI show a "long-horizon HUD run" with a reward and a
GRPO group. By default those are *projected* from the declared layout (see
``src/job_sources.py``) — no model is actually rolled out. This script produces
the *measured* version: for each Staer floor it runs a real group of rollouts
against the ``operate_floor`` HUD task, then records the measured mean reward and
the real group-relative advantages.

Output: ``results/floor_hud_runs.json`` keyed by floor id. ``job_sources`` reads
it and attaches it to the stream as ``hud_rollout.measured`` so the UI can show
"Measured HUD run" instead of the projection. Floors not in the file stay
projected (and are labelled as such).

    # one floor, group of 4 (smoke)
    python distill/hud_floor_eval.py --model shiftbench-qwen36-27b --max-floors 1 --group 4

    # all floors
    python distill/hud_floor_eval.py --model shiftbench-qwen36-27b --max-floors 99 --group 6
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# pylint: disable=import-error,no-name-in-module,wrong-import-position
from dotenv import load_dotenv  # noqa: E402
from hud import LocalRuntime  # noqa: E402
from hud.agents import create_agent  # noqa: E402
from hud.agents.types import AgentStep  # noqa: E402
from hud.eval import Job, Taskset  # noqa: E402

from distill.hud_app import operate_floor  # noqa: E402
from distill.hud_rollout_util import run_taskset_with_retry  # noqa: E402
from isaac.plan_to_isaac import plan_to_tasks  # noqa: E402
from src.floor_prompt import JSON_SYSTEM_PROMPT, floor_prompt_and_state  # noqa: E402
from src.hud_env import extract_json_object, group_relative  # noqa: E402
from src.library import ARCHETYPES  # noqa: E402
from src.schemas import ActionPlan  # noqa: E402
from src.verifier import evaluate  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "distill" / "hud_app.py"
OUT = ROOT / "results" / "floor_hud_runs.json"


def _rewards(runs: list) -> list[float]:
    return [float(getattr(r, "reward", 0.0) or 0.0) for r in runs]


def _response_text(run) -> str:
    """Extract the model response text from a HUD run trace, best-effort."""
    trace = getattr(run, "trace", None)
    if not trace:
        return ""
    text = ""
    for step in trace.collect(lambda s: s if isinstance(s, AgentStep) else None):
        content = getattr(step, "content", "")
        if content:
            text = str(content)
    return text


def _hud_model_id(name: str) -> str | None:
    """Resolve the HUD model UUID for a model name, so the UI can surface the exact
    HUD model that ran the reward rollouts (and link to it). Best-effort; returns
    None if the CLI is unavailable."""
    import re
    import subprocess
    try:
        out = subprocess.run(["hud", "models", "list", "--json"],
                              capture_output=True, text=True, timeout=20).stdout
        m = re.search(r"(\[|\{)", out)
        if not m:
            return None
        data = json.loads(out[m.start():])
        models = data if isinstance(data, list) else data.get("models", [])
        for mo in models:
            if mo.get("name") == name:
                return mo.get("id")
    except Exception:
        return None
    return None


def _qwen_candidate_from_answer(*, floor_id: str, seed: int, answer: str,
                                trace_id: str | None = None) -> dict:
    """Convert the best measured Qwen ActionPlan into the simulator task schema."""
    candidate = {
        "source": "best_measured_hud_rollout",
        "floor_id": floor_id,
        "seed": seed,
        "trace_id": trace_id,
        "trace_url": f"https://hud.ai/trace/{trace_id}" if trace_id else None,
        "answer_excerpt": answer[:2200],
    }
    try:
        raw = extract_json_object(answer)
        if raw is None:
            candidate.update({"ok": False, "error": "no parseable JSON object in Qwen answer"})
            return candidate
        state = floor_prompt_and_state(floor_id, seed)[1]
        plan = ActionPlan.model_validate(raw)
        res = evaluate(state, plan)
        candidate.update({
            "ok": True,
            "hard_violations": res.n_hard,
            "verifier_reward": round(res.reward, 2),
            "metrics": res.metrics,
            "isaac_tasks": plan_to_tasks(state, plan),
        })
    except Exception as exc:  # pragma: no cover - artifact should preserve the failure reason
        candidate.update({"ok": False, "error": f"{type(exc).__name__}: {exc}"[:300]})
    return candidate


def _floor_ids(max_floors: int, requested: list[str]) -> list[str]:
    known = [a["id"] for a in ARCHETYPES]
    if requested:
        return [fid for fid in requested if fid in known]
    return known[: max(1, max_floors)]


async def eval_floor(runtime: LocalRuntime, agent, *, floor_id: str, seed: int,
                     group: int, reward_mode: str, max_concurrent: int) -> dict:
    """Run one GRPO group (``group`` samples of the same floor task) and measure it."""
    task = operate_floor(floor_id=floor_id, seed=seed, reward_mode=reward_mode)
    taskset = Taskset(f"floor-eval-{floor_id}", [task])
    job = await Job.start(f"shiftbench-floor-eval-{floor_id}", group=group)
    await run_taskset_with_retry(
        taskset, agent, runtime=runtime, group=group, job=job,
        max_concurrent=max_concurrent, label=f"eval-{floor_id}",
    )
    rewards = [round(r, 4) for r in _rewards(job.runs)]
    mean = sum(rewards) / max(1, len(rewards))
    advantages = [round(a, 4) for a in group_relative(rewards, normalize_std=False)]
    best_idx = max(range(len(rewards)), key=lambda i: rewards[i]) if rewards else 0
    samples = []
    best_text = ""
    best_trace_id = None
    for i, run in enumerate(job.runs):
        text = _response_text(run)
        if i == best_idx:
            best_text = text
            best_trace_id = getattr(run, "trace_id", None) or getattr(getattr(run, "trace", None), "id", None)
        samples.append({
            "rollout": f"R{i + 1:02d}",
            "reward": rewards[i] if i < len(rewards) else None,
            "advantage": advantages[i] if i < len(advantages) else None,
            "trace_id": getattr(run, "trace_id", None) or getattr(getattr(run, "trace", None), "id", None),
            "has_json": "{" in text and "}" in text,
            "chars": len(text),
            "response_excerpt": text[:1600],
        })
    return {
        "n_rollouts": len(rewards),
        "group_size": group,
        "rollout_rewards": rewards,
        "advantages": advantages,
        "mean_reward": round(mean, 4),
        "best_rollout": f"R{best_idx + 1:02d}",
        "hud_job_id": getattr(job, "id", None),
        "hud_job_url": f"https://hud.ai/jobs/{getattr(job, 'id', '')}" if getattr(job, "id", None) else None,
        "task_coverage": {
            "platform_percent": 0,
            "reason": "local Taskset/LocalRuntime run has no deployed HUD taskset_id; rewards/traces are real, but platform task coverage requires hud sync/deployed tasksets",
            "dashboard_url": "https://hud.ai/jobs",
        },
        "rollout_samples": samples,
        "qwen_candidate": _qwen_candidate_from_answer(
            floor_id=floor_id, seed=seed, answer=best_text, trace_id=best_trace_id,
        ),
    }


async def main(args: argparse.Namespace) -> dict:
    load_dotenv(ROOT / ".env")
    model = args.model or os.environ.get("HUD_TRAIN_MODEL") or os.environ.get("HUD_BASELINE_MODEL")
    floors = _floor_ids(args.max_floors, args.floor_id)
    hud_model_id = _hud_model_id(model) if model else None
    hud_model_url = f"https://hud.ai/models/{hud_model_id}" if hud_model_id else None
    summary: dict = {
        "kind": "measured_floor_hud_runs",
        "model": model,
        "hud_model_id": hud_model_id,
        "hud_model_url": hud_model_url,
        "reward_mode": args.reward_mode,
        "group": args.group,
        "floors_requested": floors,
        "dry_run": args.dry_run or not model,
    }
    if not model:
        summary["ok"] = False
        summary["error"] = "Set --model or HUD_TRAIN_MODEL to a HUD gateway model from `hud models list`."
        return summary
    if args.dry_run:
        summary["ok"] = True
        summary["note"] = "Dry run: floors selected, no rollouts submitted."
        return summary

    extra_body: dict = {}
    if args.no_think:
        extra_body["chat_template_kwargs"] = {"enable_thinking": False}
    completion_kwargs = {"max_tokens": args.max_tokens}
    if extra_body:
        completion_kwargs["extra_body"] = extra_body
    if args.json_mode:
        completion_kwargs["response_format"] = {"type": "json_object"}
    agent_kwargs = {"completion_kwargs": completion_kwargs, "system_prompt": JSON_SYSTEM_PROMPT}
    if args.checkpoint:
        # Route to a specific checkpoint instead of the model's active head, so we
        # can A/B a trained checkpoint against base without changing the head.
        agent_kwargs["checkpoint"] = args.checkpoint
    agent = create_agent(model, **agent_kwargs)
    summary["checkpoint"] = args.checkpoint
    runtime = LocalRuntime(APP, env="factoryceo-trm")

    out_path = Path(args.out)
    # Merge into any existing measured file so partial runs accumulate.
    existing: dict = {}
    if out_path.exists():
        try:
            existing = json.loads(out_path.read_text(encoding="utf-8")).get("runs", {})
        except Exception:
            existing = {}

    t0 = time.perf_counter()
    runs: dict = dict(existing)
    rows = []
    for i, fid in enumerate(floors):
        rs = time.perf_counter()
        group = await eval_floor(
            runtime, agent, floor_id=fid, seed=args.seed + i,
            group=args.group, reward_mode=args.reward_mode, max_concurrent=args.max_concurrent,
        )
        qwen_candidate = group.pop("qwen_candidate", None)
        runs[fid] = {
            "measured": True,
            "model": model,
            "hud_model_id": hud_model_id,
            "hud_model_url": hud_model_url,
            "checkpoint": args.checkpoint,
            "reward_mode": args.reward_mode,
            "hud_reward": group["mean_reward"],
            "grpo": group,
            "qwen_candidate": qwen_candidate,
            "measured_at": datetime.now(timezone.utc).isoformat(),
            "rollout_s": round(time.perf_counter() - rs, 2),
        }
        rows.append({"floor": fid, "reward": group["mean_reward"], "rewards": group["rollout_rewards"]})
        print(f"[{fid}] measured reward={group['mean_reward']} rewards={group['rollout_rewards']}", flush=True)

    payload = {
        "kind": "measured_floor_hud_runs",
        "model": model,
        "hud_model_id": hud_model_id,
        "hud_model_url": hud_model_url,
        "checkpoint": args.checkpoint,
        "reward_mode": args.reward_mode,
        "group": args.group,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "runs": runs,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    summary.update({
        "ok": True,
        "measured_floors": [r["floor"] for r in rows],
        "rows": rows,
        "out": str(out_path),
        "elapsed_s": round(time.perf_counter() - t0, 2),
    })
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=None, help="HUD gateway model to roll out (e.g. a forked trainable or open student).")
    parser.add_argument("--max-floors", type=int, default=1)
    parser.add_argument("--floor-id", action="append", default=[])
    parser.add_argument("--group", type=int, default=4, help="Rollouts per floor (the GRPO group size).")
    parser.add_argument("--reward-mode", default="shaped", choices=["format", "shaped", "strict"])
    parser.add_argument("--checkpoint", default=None, help="Route to a specific checkpoint name (e.g. step-000005) instead of the active head.")
    parser.add_argument("--out", default=str(OUT), help="Output file (use distinct paths for A/B checkpoint comparisons).")
    parser.add_argument("--seed", type=int, default=7000)
    parser.add_argument("--max-concurrent", type=int, default=1)
    parser.add_argument("--max-tokens", type=int, default=3500)
    parser.add_argument("--json-mode", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--no-think", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--dry-run", action="store_true")
    ns = parser.parse_args()
    result = asyncio.run(main(ns))
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result.get("ok") else 2)
