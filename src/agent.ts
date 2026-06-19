import type { AgentDecision, Action, AgentView, Scenario } from './types'

// ----------------------------------------------------------------------------
// Mocked agent policy.
//
// This is the *agent*, not the verifier. It is deliberately mocked and is the
// one place the loop is allowed to be imperfect.
//
// Explainability: the policy is a transparent threshold function over a single
// "visible risk" signal (0..1) that the scenario exposes. There is no hidden
// heuristic — the bands below are the entire decision rule, and they are shown
// in the UI next to every decision.
//
// Safety: `decide` takes an `AgentView`, which is a strict subset of a Scenario
// that does NOT include `hiddenRisk`, `correctAction`, or `rationale`. The
// policy structurally cannot read them.
//
// (No Nebius / LLM call yet — a learned policy swaps in behind `decide`'s shape
// later, still consuming only the AgentView.)
// ----------------------------------------------------------------------------

export interface PolicyBand {
  /** inclusive lower bound */
  from: number
  /** exclusive upper bound */
  to: number
  action: Action
  label: string
}

/** The complete mock decision rule, in order. Exported so the UI can render it. */
export const POLICY_BANDS: PolicyBand[] = [
  { from: 0.0, to: 0.3, action: 'act', label: 'looks routine -> act' },
  { from: 0.3, to: 0.55, action: 'ask', label: 'borderline -> ask' },
  { from: 0.55, to: 0.8, action: 'escalate', label: 'elevated -> escalate' },
  { from: 0.8, to: 1.01, action: 'stop', label: 'clear danger -> stop' },
]

function bandFor(score: number): PolicyBand {
  return POLICY_BANDS.find((b) => score >= b.from && score < b.to) ?? POLICY_BANDS[POLICY_BANDS.length - 1]
}

const REASONS: Record<Action, string> = {
  act: 'Visible signals read as routine and low-risk, so the policy acts.',
  ask: 'Visible signals are borderline; a quick human confirmation is cheap, so the policy asks.',
  escalate: 'Visible signals read as elevated; the policy escalates to a human owner.',
  stop: 'Visible signals indicate a clear danger; the policy stops.',
}

/** Project a full scenario down to only what the agent is allowed to see. */
export function toAgentView(scenario: Scenario): AgentView {
  return {
    id: scenario.id,
    domain: scenario.domain,
    title: scenario.title,
    situation: scenario.situation,
    visibleSignals: scenario.visibleSignals,
    visibleRiskScore: scenario.visibleRiskScore,
  }
}

/** Decide an action from the view's visible risk signal. Deterministic. */
export function decide(view: AgentView): AgentDecision {
  const score = view.visibleRiskScore
  const band = bandFor(score)
  // Confidence is highest at the extremes of the visible risk scale.
  const distanceFromMid = Math.abs(score - 0.5)
  const confidence = Math.min(0.99, Math.round((0.55 + distanceFromMid * 0.9) * 100) / 100)
  return {
    action: band.action,
    confidence,
    rationale: REASONS[band.action],
    source: 'mock',
    policySignal: score,
    policyBand: `visible risk ${score.toFixed(2)} in [${band.from.toFixed(2)}, ${
      band.to >= 1 ? '1.00' : band.to.toFixed(2)
    }) -> ${band.action.toUpperCase()}`,
  }
}
