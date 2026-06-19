// ----------------------------------------------------------------------------
// PROTOTYPE server-owned episode path for the hackathon.
//
// Trust boundary: the client sends ONLY { scenarioId, policyMode }. Everything
// authoritative — the canonical scenario, the policy view, the chosen action,
// the deterministic verifier result, reward, and license — is computed HERE on
// the server. The client never supplies (and the server never trusts) hiddenRisk,
// correctAction, verifierResult, reward, licenseLevel, catastrophic, pass/fail,
// expected action, or license summary.
//
// The deterministic verifier remains the source of truth. InsForge only stores
// the resulting evidence; it is never consulted to decide an outcome.
// ----------------------------------------------------------------------------

// NOTE: value imports use explicit .ts extensions so this module also runs under
// Node's native ESM loader (the verification script imports it directly). Vite +
// tsc tolerate this via allowImportingTsExtensions. Type-only imports are erased,
// so they don't need extensions.
import { decide, toMockView, toModelView } from '../src/agent.ts'
import { computeLicense } from '../src/license.ts'
import { SCENARIO_VERSION, seedScenarios } from '../src/seedScenarios.ts'
import { verify } from '../src/verifier.ts'
import type { AgentDecision, EvidenceStatus, LicenseState, RecentRun, Trace } from '../src/types'
import {
  ENVIRONMENT_NAME,
  LICENSE_POLICY_VERSION,
  REWARD_MODEL_VERSION,
  SCENARIO_REGISTRY_VERSION,
  VERIFIER_VERSION,
  getEvalVersions,
} from './evalVersions.ts'
import { handleNebiusAction, type NebiusHandlerConfig } from './nebiusHandler.ts'
import {
  INSFORGE_TABLE,
  insforgeConfigured,
  persistEpisode,
  type InsforgeConfig,
} from './insforgeStore.ts'

export interface RunEpisodeConfig {
  nebius: NebiusHandlerConfig
  insforge: InsforgeConfig
}

type PolicyMode = 'mock' | 'nebius'

interface RunRecord {
  trace: Trace
  persistedId: string | null
  createdAt: string
}

export interface PersistenceOutcomeDTO {
  configured: boolean
  status: 'saved' | 'local_only' | 'unavailable'
  recordId?: string | null
  code?: string
  table: string
}

export type RunEpisodeResult =
  | {
      ok: true
      trace: Trace
      license: LicenseState
      persistence: PersistenceOutcomeDTO
      runId: string
      /** Full persisted audit row — for the server/verification only, NOT sent to the client. */
      auditRow: Record<string, unknown>
    }
  | { ok: false; code: 'bad_request' | 'unknown'; error: string }

// Server-owned, in-memory authoritative run history. Survives client reloads
// (the dev server keeps running); resets on server restart. InsForge is the
// durable store. NOTE: a single shared history is fine for the single-user demo.
const serverRecords: RunRecord[] = []

// One run id per server process — groups this session's episodes.
let runId: string | null = null
function getRunId(): string {
  if (!runId) runId = `run_${new Date().toISOString().replace(/[:.]/g, '-')}`
  return runId
}
/** Peek the run id WITHOUT generating one (for the status endpoint). */
function currentRunId(): string | null {
  return runId
}

// Monotonic per-process episode counter — never resets within a run.
let runSequence = 0

function licenseSignalFor(passed: boolean, catastrophic: boolean): string {
  return catastrophic ? 'caps license' : passed ? 'builds trust' : 'erodes trust'
}

/**
 * Run one server-owned episode: load canonical scenario, run policy (mock or
 * Nebius with mock fallback), score with the deterministic verifier, update the
 * server-owned license, persist the evidence to InsForge (best-effort).
 */
export async function handleRunEpisode(
  body: unknown,
  cfg: RunEpisodeConfig,
): Promise<RunEpisodeResult> {
  const b = (body ?? {}) as { scenarioId?: unknown; policyMode?: unknown }
  const scenarioId = typeof b.scenarioId === 'string' ? b.scenarioId : ''
  const policyMode: PolicyMode = b.policyMode === 'nebius' ? 'nebius' : 'mock'
  if (b.policyMode !== 'mock' && b.policyMode !== 'nebius') {
    return { ok: false, code: 'bad_request', error: 'policyMode must be "mock" or "nebius".' }
  }

  // Load the canonical scenario from the server-side registry.
  const scenario = seedScenarios.find((s) => s.id === scenarioId)
  if (!scenario) {
    return { ok: false, code: 'bad_request', error: 'Unknown scenarioId.' }
  }

  // Run the policy. Track requested vs actual provenance explicitly so a Nebius
  // fallback is never confused with a genuine mock run.
  // - attemptedModelInput: the ModelPolicyView intended for Nebius (null for mock).
  // - actualPolicyInput:   the view actually consumed by the policy that decided.
  let decision: AgentDecision
  let fallback = false
  let fallbackCode: string | null = null
  let attemptedModelInput: unknown = null
  let actualPolicyInput: unknown

  if (policyMode === 'nebius') {
    const modelView = toModelView(scenario)
    attemptedModelInput = modelView
    const r = await handleNebiusAction({ view: modelView }, cfg.nebius)
    if (r.ok) {
      actualPolicyInput = modelView
      decision = {
        action: r.decision.action,
        confidence: r.decision.confidence,
        rationale: r.decision.rationale,
        requestedInfo: r.decision.requestedInfo,
        source: 'nebius',
        model: r.model,
      }
    } else {
      // Nebius failed — fall back to the mock policy, but keep both inputs.
      fallback = true
      fallbackCode = r.code
      const mockView = toMockView(scenario)
      actualPolicyInput = mockView
      decision = decide(mockView)
    }
  } else {
    const mockView = toMockView(scenario)
    actualPolicyInput = mockView
    decision = decide(mockView)
  }

  // Deterministic verifier — the source of truth.
  const result = verify(scenario, decision)

  const episode = serverRecords.length + 1
  runSequence += 1
  const traceId = `srv-${getRunId()}-${episode}-${scenario.id}`
  const versions = getEvalVersions()
  const provenance = {
    requestedPolicyMode: policyMode,
    actualPolicySource: decision.source,
    fallback,
    fallbackCode,
  }
  const trace: Trace = {
    id: traceId,
    episode,
    scenario,
    decision,
    result,
    licenseSignal: licenseSignalFor(result.passed, result.catastrophic),
    authority: 'server_authoritative_episode',
    versions,
    provenance,
  }

  const createdAt = new Date().toISOString()
  const record: RunRecord = { trace, persistedId: null, createdAt }
  serverRecords.push(record)

  const license = computeLicense(serverRecords.map((r) => r.trace))
  const licenseSummary = {
    level: license.level.id,
    name: license.level.name,
    passRate: license.passRate,
    avgReward: license.avgReward,
    catastrophicCount: license.catastrophicCount,
    episodes: license.episodes,
  }

  // Build the replayable audit row and persist (best-effort). Includes identity,
  // attribution versions, explicit fallback attribution, and the canonical
  // scenario snapshot (server-owned ground truth).
  const auditRow: Record<string, unknown> = {
    // identity
    trace_id: traceId,
    run_id: getRunId(),
    episode_index: episode,
    run_sequence: runSequence,
    trace_authority: 'server_authoritative_episode',
    // attribution versions
    environment_name: ENVIRONMENT_NAME,
    scenario_registry_version: SCENARIO_REGISTRY_VERSION,
    verifier_version: VERIFIER_VERSION,
    reward_model_version: REWARD_MODEL_VERSION,
    license_policy_version: LICENSE_POLICY_VERSION,
    app_commit: versions.appCommit,
    // scenario
    scenario_id: scenario.id,
    scenario_version: SCENARIO_VERSION,
    scenario_title: scenario.title,
    domain: scenario.domain,
    scenario_snapshot: scenario,
    // policy provenance (requested vs actual)
    requested_policy_mode: policyMode,
    actual_policy_source: decision.source,
    fallback,
    fallback_code: fallbackCode,
    attempted_model_input: attemptedModelInput,
    actual_policy_input: actualPolicyInput,
    // decision
    model_name: decision.model ?? null,
    action: decision.action,
    rationale: decision.rationale,
    requested_info: decision.requestedInfo ?? '',
    confidence: decision.confidence,
    // deterministic verifier result
    passed: result.passed,
    reward: result.reward,
    category: result.category,
    catastrophic: result.catastrophic,
    expected_action: result.expectedAction,
    actual_action: result.chosenAction,
    verifier_reason: result.failureReason,
    verifier_checks: result.checks,
    // license + time
    license_level: license.level.id,
    license_summary: licenseSummary,
    created_at: createdAt,
  }

  const persist = await persistEpisode(auditRow, cfg.insforge)
  if (persist.status === 'saved') record.persistedId = persist.recordId

  return {
    ok: true,
    trace,
    license,
    persistence: {
      configured: insforgeConfigured(cfg.insforge),
      status: persist.status,
      recordId: persist.status === 'saved' ? persist.recordId : undefined,
      code: persist.status === 'unavailable' ? persist.code : undefined,
      table: INSFORGE_TABLE,
    },
    runId: getRunId(),
    auditRow,
  }
}

/** Compact server evidence status — backend proof that survives a client reload. */
export function getEvidenceStatus(cfg: RunEpisodeConfig): EvidenceStatus {
  const last = serverRecords[serverRecords.length - 1]
  const configured = insforgeConfigured(cfg.insforge)
  const license = computeLicense(serverRecords.map((r) => r.trace))
  return {
    runId: currentRunId(),
    serverEpisodeCount: serverRecords.length,
    currentLicenseSummary:
      serverRecords.length === 0
        ? null
        : {
            level: license.level.id,
            name: license.level.name,
            passRate: license.passRate,
            avgReward: license.avgReward,
            catastrophicCount: license.catastrophicCount,
            episodes: license.episodes,
          },
    latestServerTraceId: last?.trace.id ?? null,
    latestPersistedRecordId: last?.persistedId ?? null,
    persistence: {
      configured,
      status: configured ? 'configured' : 'local_only',
      table: INSFORGE_TABLE,
    },
    recentCompactRuns: getRecentRuns(5),
  }
}

/** Recent server-owned episodes from in-memory history (newest first). */
export function getRecentRuns(limit = 10): RecentRun[] {
  return serverRecords
    .slice(-limit)
    .reverse()
    .map((r) => ({
      id: r.trace.id,
      episode: r.trace.episode,
      scenarioTitle: r.trace.scenario.title,
      source: r.trace.decision.source,
      action: r.trace.decision.action,
      passed: r.trace.result.passed,
      reward: r.trace.result.reward,
      category: r.trace.result.category,
      catastrophic: r.trace.result.catastrophic,
      authority: 'server_authoritative_episode',
      persistedId: r.persistedId,
      createdAt: r.createdAt,
    }))
}
