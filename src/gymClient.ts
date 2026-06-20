import type {
  Action,
  AgentDecision,
  Domain,
  GymObservation,
  GymResetResult,
  GymStepResult,
  ModelPolicyView,
  Scenario,
  Trace,
  TraceProvenance,
  VerifierResult,
} from './types'

// ----------------------------------------------------------------------------
// Frontend client for the canonical gym env (`/v1` reset/step).
//
// The browser only PROPOSES an action; the ENVIRONMENT verifies it, computes the
// reward, and computes the license. The reset body carries ONLY { scenarioId,
// agentId }; the step body carries ONLY { action }. The client never sends — and
// the env never trusts — confidence, rationale, reward, verifier result, expected
// action, catastrophic, license, or any hidden scenario field.
// ----------------------------------------------------------------------------

/** reset — open a signed episode and return the observation the agent may see. */
export async function resetGymEpisode(scenarioId: string, agentId: string): Promise<GymResetResult> {
  const resp = await fetch('/v1/episodes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scenarioId, agentId }),
  })

  type Ok = GymResetResult & { ok: true }
  type Err = { ok: false; error?: string }
  let data: Ok | Err | null = null
  try {
    data = (await resp.json()) as Ok | Err
  } catch {
    // Non-JSON / missing endpoint — treated as failure below.
  }

  if (!data || data.ok !== true) {
    throw new Error(data && 'error' in data && data.error ? data.error : 'Gym reset unavailable')
  }
  return {
    episodeId: data.episodeId,
    runId: data.runId,
    agentId: data.agentId,
    observation: data.observation,
    allowedActions: data.allowedActions,
    verifierRules: data.verifierRules,
  }
}

/** step — submit ONLY the chosen action; the env scores it authoritatively. */
export async function stepGymEpisode(episodeId: string, action: Action): Promise<GymStepResult> {
  const resp = await fetch(`/v1/episodes/${encodeURIComponent(episodeId)}/step`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // The step body carries the action and nothing else.
    body: JSON.stringify({ action }),
  })

  type Ok = GymStepResult & { ok: true }
  type Err = { ok: false; error?: string }
  let data: Ok | Err | null = null
  try {
    data = (await resp.json()) as Ok | Err
  } catch {
    // Non-JSON / missing endpoint — treated as failure below.
  }

  if (!data || data.ok !== true) {
    throw new Error(data && 'error' in data && data.error ? data.error : 'Gym step unavailable')
  }
  return {
    episodeId: data.episodeId,
    runId: data.runId,
    agentId: data.agentId,
    reward: data.reward,
    done: data.done,
    info: data.info,
    license: data.license,
    persisted: data.persisted,
    recordId: data.recordId,
  }
}

/** Map a gym observation to the strict model view a reference agent may see. */
export function observationToModelView(obs: GymObservation): ModelPolicyView {
  return {
    id: obs.scenarioId,
    domain: obs.domain as Domain,
    title: obs.title,
    situation: obs.situation,
    visibleSignals: obs.visibleSignals,
  }
}

/**
 * Build the displayed Trace from a `/v1` step result. The verifier verdict,
 * reward, and license signal all come from the ENVIRONMENT — this never re-runs
 * the verifier in the browser. `scenario` is the local canonical copy, used only
 * to reveal hidden risk in the UI after scoring.
 */
export function buildGymTrace(
  scenario: Scenario,
  decision: AgentDecision,
  step: GymStepResult,
  provenance: TraceProvenance,
): Trace {
  const info = step.info
  const result: VerifierResult = {
    passed: info.passed,
    reward: step.reward,
    category: info.category,
    expectedAction: info.expectedAction,
    chosenAction: info.actualAction,
    failureReason: info.reason,
    catastrophic: info.catastrophic,
    // Synthesized from the env's own response (not a re-run of the verifier).
    checks: [
      `Server-authoritative gym episode scored by agent "${step.agentId}".`,
      `Environment verifier: got ${info.actualAction.toUpperCase()} · expected ` +
        `${info.expectedAction.toUpperCase()} → ${info.category} · reward ${step.reward.toFixed(2)}.`,
    ],
  }
  const licenseSignal = info.catastrophic
    ? 'caps license'
    : info.passed
      ? 'builds trust'
      : 'erodes trust'
  return {
    id: `${step.runId}-ep${step.license.episodes}`,
    episode: step.license.episodes,
    scenario,
    decision,
    result,
    licenseSignal,
    authority: 'server_authoritative_episode',
    provenance,
  }
}
