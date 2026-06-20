# Claude Bridge Output

## Mode
Review + respond only. The user did **not** approve the next iteration, so per
`.agentloop/BRIDGE.md` I reviewed the current state (including Codex's report
layer) and am responding. **No product code changed this pass.**

## Verification of current state (Codex's report layer)
- `npm run gates` → **GREEN**: build + lint + verify:evidence (40 checks) +
  **111 tests / 14 files**. Matches Codex's reported count.
- `src/licenseReport.ts` reviewed: deterministic, derives everything from the
  oracle baseline + demo (`buildPhysicalAiLicenseReport`), no LLM, no `Date.now`,
  `reportId = plan.id + demo.version` (stable). Has its own test. Respects all
  non-negotiables. OK.
- Browser walk-through (fresh dev server, `dad's-factory / Manufacturing /
  Humanoid`): landing -> intake -> preview -> results all functional; the new
  results report-strip renders — **decision badge** "Reference environment ready",
  4-line **operating envelope**, 4-step **pilot next steps**, collapsible
  **Report JSON** ("17 tags · 17 pairs · 22 reward rows") with a `<pre>` dump.
- Responsive: at 375px **no horizontal overflow**; `.results-summary` and
  `.report-strip` collapse to a single column; triptych stacks. Desktop unchanged.
- Note: an earlier in-session preview got wedged after many HMR cycles (stale
  Fast-Refresh state, not a code defect — the landing/nav handlers are unchanged
  from when the flow worked). A clean dev-server restart fixed it.

## Assessment of Codex's report layer
Accept as-is. It's a genuine product upgrade (turns scattered panels into a
readable readiness report) and stays inside the trust boundary.

**One clarity concern (not a blocker):** the "Deployment decision" badge is
computed from the **calibrated oracle** baseline, which is perfectly calibrated by
construction (FAR/FRR = 0). So it will essentially always read "Reference
environment ready" and can never surface "Supervised pilot only" / "Not ready"
until a *real model* is scored. The surrounding copy is honest ("A live
robot/model still needs to run the same eval"), but a judge could misread the
badge as grading the robot. Recommend (small): scope the badge label to the
environment/reference explicitly, or hold a true deployment decision until the
model path lands. Filed under Questions.

## On Codex's recommended next iteration (investor/judge-ready polish)
I agree with the scope and it respects the non-negotiables. I have **not**
implemented it (awaiting user approval). Pre-cleared critique so we can move fast
on green light:

1. **Landing storytelling** — "Why now / why us" + sharpened dad/factory wedge +
   "Pilot package" (what the customer gives / what they get back).
   - Agree. Risk: the "48 hours" promise reads as a binding SLA — frame it as an
     illustrative pilot turnaround, not a guarantee.
   - The Pilot-package "what you get back" should mirror the report's
     operating-envelope / next-steps so the story and the artifact match.
2. **Results polish** — copy/download the report JSON without new deps.
   - Feasible natively: `navigator.clipboard.writeText` for copy; `Blob` +
     `URL.createObjectURL` + a temporary `<a download>` for download. No
     dependency, deterministic filename from `report.reportId`.
3. **Disclaimer** — "not a certification authority yet; readiness evidence pack."
   - Agree, and on-brand with the AIUC wedge ("certification attests; we train &
     measure"). Put it on results + a landing footer.
4. **Responsive review** — already did a first pass (mobile 375 clean, grids
   collapse). Will formalize across landing/intake/preview if approved.

**I will NOT (per Codex "avoid" + GOAL):** real upload parsing, InsForge schema
changes, live model spend, procedural grid generation.

### Optional additions I'd propose (only if you want them in scope)
- Fix the decision-badge semantics (above) — cheapest, highest clarity win.
- An **embodiment comparison** strip (humanoid vs carrier vs arm FAR/FRR on the
  same plan) — strong, fully deterministic investor visual, no spend.
- Consolidate the two overlapping summaries on results ("reference ceiling"
  license card + "deployment decision") to reduce redundancy.

## Handoff To Codex
Status: Reviewed current build (incl. your report layer) — gates green, report +
results verified in-browser and responsive. Phase 1+2 + report layer look
shippable. Awaiting user approval before implementing the polish iteration.
Needs: explicit user/Codex green-light to start the investor-polish iteration
(scope items 1-4 above). Confirm whether the optional decision-badge fix and
embodiment-comparison strip are in or out of scope.
Files changed: none (review-only pass). This file (`.agentloop/claude.md`) is the
only write.
Gates: `npm run gates` GREEN — build + lint + verify:evidence (40) + 111 tests /
14 files.
Questions:
1. Decision-badge today reflects the oracle (always "Reference environment
   ready"); rescope its label or defer a real decision to the model path?
2. Is the JSON copy/download (Clipboard + Blob, no deps) acceptable, and do you
   want a download file or copy-to-clipboard only?
3. Are the optional items (decision-badge fix, embodiment-comparison strip,
   summary consolidation) in scope for this iteration or deferred?
