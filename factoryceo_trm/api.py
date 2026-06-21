"""FactoryCEO-TRM backend service (FastAPI).

Exposes the verifiable factory brain as an HTTP API so another repo can use it as
a backend: generate a scenario, get a verifier-gated plan, verify/repair an
existing plan, score reward, and export the humanoid task queue for Isaac.

    uvicorn api:app --reload --port 8090     # or: python api.py

Every endpoint is a thin wrapper over the pure functions in src/ — the planner is
selectable (deterministic / fireworks / anthropic / vllm); all of them flow
through the same verifier + recursive TRM repair loop.
"""

from __future__ import annotations

from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.schemas import FactoryState, ActionPlan
from src.generator import generate_state, corrupt_plan, messy_prompt
from src.baselines import greedy
from src.verifier import evaluate
from src.repair_loop import repair_loop
from src.hud_env import hybrid_reward, normalized_reward
from src.data_export import build_episode
from src.intake import intake_state
from src.llm import (DeterministicPlanner, FireworksPlanner, AnthropicPlanner,
                     VLLMPlanner, vision_caption)
from isaac.plan_to_isaac import plan_to_tasks

app = FastAPI(title="FactoryCEO-TRM", version="1.0",
              description="Verifiable autonomous factory-operations brain.")
# the console (Vite) calls this from the browser
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"],
                   allow_headers=["*"])

PLANNERS = {
    "deterministic": DeterministicPlanner,
    "fireworks": FireworksPlanner,
    "anthropic": AnthropicPlanner,
    "vllm": VLLMPlanner,
}


def _planner(name: str):
    return PLANNERS.get(name, DeterministicPlanner)()


# --------------------------------------------------------------------------- #
# request models
# --------------------------------------------------------------------------- #
class PlanReq(BaseModel):
    state: Optional[FactoryState] = None     # supply a state, or generate one
    seed: int = 0
    horizon_days: int = 30
    planner: str = "deterministic"           # deterministic|fireworks|anthropic|vllm
    repair_K: int = 60
    return_trace: bool = True


class StatePlan(BaseModel):
    state: FactoryState
    plan: ActionPlan
    K: int = 60


# --------------------------------------------------------------------------- #
# endpoints
# --------------------------------------------------------------------------- #
@app.get("/health")
def health():
    return {"ok": True, "planners": list(PLANNERS)}


@app.get("/scenario")
def scenario(seed: int = 0, horizon_days: int = 30, n_jobs: int = 14):
    s = generate_state(seed=seed, horizon_days=horizon_days, n_jobs=n_jobs)
    return {"messy_prompt": messy_prompt(s, seed=seed), "state": s.model_dump(mode="json")}


@app.post("/plan")
def plan(req: PlanReq):
    """Propose a plan with the chosen planner, then verify + recursively repair it.
    Returns the gated final plan, metrics, reward and (optionally) the repair trace."""
    state = req.state or generate_state(seed=req.seed, horizon_days=req.horizon_days)
    candidate = _planner(req.planner).plan(state)
    final, trace = repair_loop(state, candidate, K=req.repair_K)
    res = evaluate(state, final)
    out = {
        "plan": final.model_dump(mode="json"),
        "metrics": res.metrics,
        "n_hard": res.n_hard,
        "executable": res.n_hard == 0,
        "reward": hybrid_reward(state, final),
    }
    if req.return_trace:
        out["repair_trace"] = trace
    return out


@app.post("/verify")
def verify(sp: StatePlan):
    res = evaluate(sp.state, sp.plan)
    return {"errors": res.errors_as_dicts(), "reward": res.reward,
            "n_hard": res.n_hard, "metrics": res.metrics}


@app.post("/repair")
def repair(sp: StatePlan):
    final, trace = repair_loop(sp.state, sp.plan, K=sp.K)
    return {"plan": final.model_dump(mode="json"), "repair_trace": trace,
            "metrics": evaluate(sp.state, final).metrics}


@app.post("/reward")
def reward(sp: StatePlan):
    return hybrid_reward(sp.state, sp.plan)


@app.post("/isaac_tasks")
def isaac_tasks(sp: StatePlan):
    """Verified plan -> humanoid task queue for Isaac Sim/Lab."""
    return plan_to_tasks(sp.state, sp.plan)


class InputFile(BaseModel):
    name: str = ""
    kind: str = "text"          # text | image (data URL) | video (sampled frames)
    content: str = ""           # text content, or a base64 data URL for image frames


class InputReq(BaseModel):
    text: str = ""
    files: list[InputFile] = []
    horizon_days: Optional[int] = None


@app.post("/plan_from_input")
def plan_from_input(req: InputReq):
    """Multi-modal intake: free-form text + text files + image/video frames -> a
    real feasible FactoryState -> proposed plan -> verified, repaired plan +
    humanoid queue. Image/video frames (base64 data URLs) are captioned by a
    Fireworks VLM and folded into the description. Returns the same episode shape
    the FactoryCEO panel renders."""
    files_text = "\n".join(f.content for f in req.files if f.kind == "text")
    frames = [f.content for f in req.files
              if f.kind in ("image", "video") and f.content.startswith("data:")]
    caption = vision_caption(frames, hint=req.text) if frames else None
    if caption:
        files_text = f"{files_text}\n[from uploaded footage] {caption}".strip()
    state, info = intake_state(req.text, files_text, horizon_days=req.horizon_days)
    info["vision_caption"] = caption
    cand = corrupt_plan(state, greedy(state), seed=0, n_corruptions=6)  # rough proposal
    episode = build_episode(state, cand, seed=0, K=60)
    final, _ = repair_loop(state, cand, K=60)
    return {"episode": episode, "isaac_tasks": plan_to_tasks(state, final),
            "intake": info, "reward": hybrid_reward(state, final)}


class RegionReq(BaseModel):
    """The CEO lasso-selects a region of the live floor plan; we optimize it.

    Supply a state (or generate one with `seed`), plus the `machine_ids` inside
    the selected rectangle. The full plan is verified + repaired, then we report
    the region scoped to those machines: which jobs/ops touch them, the humanoid
    queue restricted to them, and the verifier verdict."""
    state: Optional[FactoryState] = None
    seed: int = 0
    horizon_days: int = 30
    machine_ids: list[str] = []
    repair_K: int = 60


@app.post("/optimize_region")
def optimize_region(req: RegionReq):
    state = req.state or generate_state(seed=req.seed, horizon_days=req.horizon_days)
    sel = set(req.machine_ids) or {m.id for m in state.machines}
    cand = corrupt_plan(state, greedy(state), seed=req.seed, n_corruptions=6)
    episode = build_episode(state, cand, seed=req.seed, K=req.repair_K)
    final, _ = repair_loop(state, cand, K=req.repair_K)
    res = evaluate(state, final)

    # scope to the lasso: ops scheduled on a selected machine
    region_ops = [a for a in final.schedule if a.machine_id in sel]
    region_jobs = sorted({a.job_id for a in region_ops})
    tasks = plan_to_tasks(state, final)
    region_queues = {
        oid: [t for t in q if t["machine"] in sel]
        for oid, q in tasks.get("all_queues", {}).items()
    }
    region_queues = {oid: q for oid, q in region_queues.items() if q}
    return {
        "episode": episode,
        "isaac_tasks": tasks,
        "region": {
            "machine_ids": sorted(sel),
            "job_ids": region_jobs,
            "n_ops": len(region_ops),
            "queues": region_queues,
            "verified": res.n_hard == 0,
            "hard_violations": res.n_hard,
        },
        "reward": hybrid_reward(state, final),
    }


@app.post("/episode")
def episode(req: PlanReq):
    """Full RFT/SFT episode (SYNTH-style) for one scenario: observation, initial
    plan, verified repair trace, final plan, RULER soft score."""
    state = req.state or generate_state(seed=req.seed, horizon_days=req.horizon_days)
    candidate = corrupt_plan(state, greedy(state), seed=req.seed, n_corruptions=6)
    return build_episode(state, candidate, seed=req.seed, K=req.repair_K)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8090)
