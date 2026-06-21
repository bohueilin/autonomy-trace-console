"""Multi-modal intake: free-form user input -> a real, feasible FactoryState.

The user describes their factory floor (typed notes, pasted RFQs / machine logs,
uploaded CSV/text). We compile that into a *valid* FactoryState by mapping it onto
the seed corpus and amplifying it — so the result is always feasible (the verifier
+ TRM repair then plan it), while still reflecting the user's industry, scale, and
horizon. An LLM (Fireworks/Claude) extracts the knobs when available; a keyword/
number heuristic is the offline fallback.
"""

from __future__ import annotations

import re

from .schemas import FactoryState
from .generator import load_seeds, amplify_seed, generate_state
from .llm import chat_json

INTAKE_SYS = (
    "You compile a factory operator's free-form description into JSON knobs for a "
    "scheduler. Output ONLY JSON: {\"industry\": one of "
    "[\"automotive\",\"electronics\",\"medical\",\"general\"], \"n_jobs\": int, "
    "\"horizon_days\": int, \"summary\": short string}. Infer sensible values from "
    "the text; never invent fields."
)

_INDUSTRY = {
    "automotive_clips_brackets": ["auto", "car", "vehicle", "bracket", "clip", "motor"],
    "consumer_electronics_enclosures": ["electronic", "phone", "device", "enclosure", "battery", "pcb"],
    "medical_devices_eval": ["medical", "surgical", "syringe", "device", "bio", "health"],
}


def _first_int(text: str, lo: int = 4, hi: int = 40) -> int | None:
    for m in re.findall(r"\b(\d{1,3})\b", text):
        v = int(m)
        if lo <= v <= hi:
            return v
    return None


def _stable_hash(text: str) -> int:
    h = 0
    for c in text:
        h = (h * 131 + ord(c)) % 1_000_000
    return h


def _pick_seed(seeds: list[dict], hint: str) -> dict:
    h = (hint or "").lower()
    for s in seeds:
        if any(k in h for k in _INDUSTRY.get(s["id"], [])):
            return s
    return next((s for s in seeds if s.get("split") == "train"), seeds[0])


def intake_state(text: str = "", files_text: str = "",
                 horizon_days: int | None = None) -> tuple[FactoryState, dict]:
    combined = f"{text}\n{files_text}".strip()
    seeds = load_seeds()
    if not combined:
        return generate_state(seed=0), {"source": "default", "industry": "default",
                                        "n_jobs": 14, "horizon_days": 30}

    knobs = chat_json(INTAKE_SYS, combined[:6000]) or {}
    source = "llm" if knobs else "heuristic"
    hint = (knobs.get("industry") or "") + " " + combined
    seed = _pick_seed(seeds, hint)
    n_jobs = int(knobs.get("n_jobs") or _first_int(combined) or 14)
    n_jobs = max(4, min(40, n_jobs))
    horizon = int(horizon_days or knobs.get("horizon_days") or 30)
    horizon = max(7, min(60, horizon))

    try:
        state = amplify_seed(seed, variant=_stable_hash(combined),
                             horizon_days=horizon, n_jobs=n_jobs)
    except Exception:
        state = generate_state(seed=_stable_hash(combined) % 10000, horizon_days=horizon)
        source = "fallback"
    return state, {"source": source, "industry": seed["id"], "n_jobs": n_jobs,
                   "horizon_days": horizon, "summary": knobs.get("summary")}
