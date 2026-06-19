// Core domain types for the Autonomy Trace Console.
// The whole app is a deterministic eval loop:
//   Scenario -> agent action -> deterministic verifier -> reward -> trace -> license level.

export type Action = 'act' | 'ask' | 'escalate' | 'stop'

export type Domain = 'commerce' | 'business_ops' | 'robotics'

export type RiskLevel = 'low' | 'medium' | 'high'

/** A single visible signal the agent is allowed to see before deciding. */
export interface VisibleSignal {
  label: string
  value: string
}

/**
 * A scenario the agent must respond to.
 *
 * `visibleSignals` + `visibleRiskScore` are everything the agent sees.
 * `hiddenRisk`, `correctAction`, and `rationale` are withheld from the agent
 * (see the policy views below) and revealed in the UI only after the verifier
 * scores the episode — this is what makes "earn autonomy before you exercise it"
 * demonstrable.
 */
export interface Scenario {
  id: string
  domain: Domain
  title: string
  situation: string
  visibleSignals: VisibleSignal[]
  /** Risk implied by the visible signals alone, 0..1. Drives the mock policy. */
  visibleRiskScore: number
  /** The true risk level, used by the verifier for asymmetric penalties. */
  riskLevel: RiskLevel
  /** The action a competent operator should take. The verifier rewards this. */
  correctAction: Action
  /** Withheld from the agent. Revealed in the UI only after scoring. */
  hiddenRisk: string
  /** Plain-English reason the correct action is correct. */
  rationale: string
}

/**
 * What the LOCAL MOCK policy sees. Includes `visibleRiskScore` — a mock-only
 * explainability artifact used by the threshold policy and the UI band bar.
 * Still structurally excludes `hiddenRisk` / `correctAction` / `rationale`.
 */
export type MockPolicyView = Pick<
  Scenario,
  'id' | 'domain' | 'title' | 'situation' | 'visibleSignals' | 'visibleRiskScore'
>

/**
 * What a real MODEL-under-test (e.g. Nebius) sees. Strictly the visible scenario
 * fields a model should reason over. Deliberately omits `visibleRiskScore` (a
 * mock artifact that would leak a heuristic answer) and, like all views,
 * structurally excludes `hiddenRisk` / `correctAction` / `rationale`.
 */
export type ModelPolicyView = Pick<
  Scenario,
  'id' | 'domain' | 'title' | 'situation' | 'visibleSignals'
>

/** Which policy produced a decision. */
export type AgentSource = 'mock' | 'nebius'

/**
 * What the agent decides, given only the visible signals. Either the local mock
 * policy or the Nebius model-under-test produces this shape; the deterministic
 * verifier only ever reads `action`, so the source is irrelevant to scoring.
 */
export interface AgentDecision {
  action: Action
  confidence: number
  rationale: string
  source: AgentSource
  /** Mock-policy explainability — present only when source === 'mock'. */
  policySignal?: number
  /** Human-readable threshold band — present only when source === 'mock'. */
  policyBand?: string
  /** Nebius model id — present only when source === 'nebius'. */
  model?: string
  /** Optional question/verification the model requested — Nebius only. */
  requestedInfo?: string
}

/** How the verifier classified a decision. Drives reward and the license gate. */
export type VerdictCategory =
  | 'correct'
  | 'over_cautious'
  | 'under_cautious'
  | 'catastrophic'

/** Deterministic verifier output for one (scenario, decision) pair. */
export interface VerifierResult {
  passed: boolean
  reward: number
  category: VerdictCategory
  expectedAction: Action
  chosenAction: Action
  /** null when passed. */
  failureReason: string | null
  /**
   * True only when the agent would have EXECUTED an irreversible, unsafe action
   * on a high-risk scenario (chose `act` where the situation required holding
   * back). This — not mere under-caution — is what caps the license.
   */
  catastrophic: boolean
  /** Step-by-step breakdown of how the verifier reached the reward. */
  checks: string[]
}

/** One full episode through the loop, stored for the trace viewer. */
export interface Trace {
  id: string
  episode: number
  scenario: Scenario
  decision: AgentDecision
  result: VerifierResult
  /** How this episode nudged the license signal. */
  licenseSignal: string
}

export type LicenseLevelId = 'L0' | 'L1' | 'L2' | 'L3' | 'L4'

export interface LicenseLevel {
  id: LicenseLevelId
  name: string
  blurb: string
  permission: string
  color: string
}

export interface LicenseState {
  level: LicenseLevel
  episodes: number
  passes: number
  passRate: number
  avgReward: number
  totalReward: number
  catastrophicCount: number
  /** Why the loop landed on this level (gate explanation). */
  reason: string
}
