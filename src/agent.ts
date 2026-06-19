import type { AgentDecision, Action, Scenario } from './types'

// ----------------------------------------------------------------------------
// Mocked agent policy.
//
// NOTE: this is the *agent*, not the verifier. It is deliberately mocked and is
// the one place the loop is allowed to be imperfect. The policy decides using
// ONLY the visible risk signal — it never sees scenario.hiddenRisk. That is why
// it confidently mishandles scenarios whose true risk is hidden, and why the
// gym is needed: surface competence != earned trust.
//
// (No Nebius / LLM call yet — that swaps in here later behind the same shape.)
// ----------------------------------------------------------------------------

// Thresholds on the visible risk score (0..1) -> action.
const THRESHOLDS: { max: number; action: Action }[] = [
  { max: 0.3, action: 'act' },
  { max: 0.55, action: 'ask' },
  { max: 0.8, action: 'escalate' },
  { max: 1.01, action: 'stop' },
]

function actionFromVisibleRisk(score: number): Action {
  for (const t of THRESHOLDS) {
    if (score < t.max) return t.action
  }
  return 'stop'
}

const REASONS: Record<Action, string> = {
  act: 'Visible signals look routine and low-risk, so I will act.',
  ask: 'Visible signals are borderline; a quick human confirmation is cheap, so I will ask.',
  escalate: 'Visible signals look elevated; I will escalate to a human owner.',
  stop: 'Visible signals indicate a clear danger; I will stop.',
}

/** Decide an action from the scenario's visible signals. Deterministic. */
export function decide(scenario: Scenario): AgentDecision {
  const action = actionFromVisibleRisk(scenario.visibleRiskScore)
  // Confidence is highest at the extremes of the visible risk scale.
  const distanceFromMid = Math.abs(scenario.visibleRiskScore - 0.5)
  const confidence = Math.round((0.55 + distanceFromMid * 0.9) * 100) / 100
  return {
    action,
    confidence: Math.min(0.99, confidence),
    rationale: REASONS[action],
  }
}
