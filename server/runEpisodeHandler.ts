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
import { computeLicense, computeLicenseFromVerdicts } from '../src/license.ts'
import { SCENARIO_VERSION, seedScenarios } from '../src/seedScenarios.ts'
import { verify } from '../src/verifier.ts'
import type {
  Action,
  AgentDecision,
  AgentSource,
  CompactRun,
  EvidenceStatus,
  HistorySource,
  LicenseState,
  RecentRun,
  Trace,
} from '../src/types'
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
  fetchRecentEvidence,
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
  runSequence: number
  /** Server-computed license level at this episode's time. */
  licenseLevel: string
}

/**
 * A normalized, version-tagged unit of authoritative evidence — built either from
 * an in-memory current-process trace or a row rehydrated from InsForge. This is
 * the shape the evidence status is computed over (deduped by traceId).
 */
export interface EvidenceItem {
  traceId: string
  episodeIndex: number
  runSequence: number
  scenarioId: string
  scenarioTitle: string
  requestedPolicyMode: 'mock' | 'nebius'
  actualPolicySource: AgentSource
  fallback: boolean
  fallbackCode: string | null
  action: Action
  passed: boolean
  reward: number
  catastrophic: boolean
  licenseLevel: string
  createdAt: string
  persistedRecordId: string | null
  versionMismatch: boolean
  source: 'memory' | 'insforge'
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
  const record: RunRecord = { trace, persistedId: null, createdAt, runSequence, licenseLevel: '' }
  serverRecords.push(record)

  const license = computeLicense(serverRecords.map((r) => r.trace))
  record.licenseLevel = license.level.id
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

// --- Evidence read-back / rehydration -------------------------------------

// Current-process records and InsForge-rehydrated rows are kept separate, then
// merged + deduped by trace_id when computing status. We rehydrate at most once.
let rehydrationDone = false
let rehydratedItems: EvidenceItem[] = []
let readOutcomeStatus: 'ok' | 'local_only' | 'unavailable' | 'error' = 'local_only'

const toStr = (v: unknown): string => (typeof v === 'string' ? v : '')
const ACTIONS: Action[] = ['act', 'ask', 'escalate', 'stop']

/** True when a row was produced by the current verifier/reward/license versions. */
export function isVersionCompatible(row: {
  verifierVersion?: string
  rewardModelVersion?: string
  licensePolicyVersion?: string
}): boolean {
  return (
    row.verifierVersion === VERIFIER_VERSION &&
    row.rewardModelVersion === REWARD_MODEL_VERSION &&
    row.licensePolicyVersion === LICENSE_POLICY_VERSION
  )
}

/** Parse a persisted InsForge row into an EvidenceItem. Returns null if the row
 * is not a valid server-authoritative episode (wrong authority / missing fields). */
export function parseEvidenceRow(raw: unknown): EvidenceItem | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.trace_authority !== 'server_authoritative_episode') return null

  const traceId = toStr(r.trace_id)
  const action = toStr(r.action) as Action
  if (!traceId || !ACTIONS.includes(action)) return null
  if (typeof r.passed !== 'boolean' || typeof r.reward !== 'number') return null

  const requested = r.requested_policy_mode === 'nebius' ? 'nebius' : 'mock'
  const actual = r.actual_policy_source === 'nebius' ? 'nebius' : 'mock'
  const versionMismatch = !isVersionCompatible({
    verifierVersion: toStr(r.verifier_version),
    rewardModelVersion: toStr(r.reward_model_version),
    licensePolicyVersion: toStr(r.license_policy_version),
  })

  return {
    traceId,
    episodeIndex: typeof r.episode_index === 'number' ? r.episode_index : 0,
    runSequence: typeof r.run_sequence === 'number' ? r.run_sequence : 0,
    scenarioId: toStr(r.scenario_id),
    scenarioTitle: toStr(r.scenario_title),
    requestedPolicyMode: requested,
    actualPolicySource: actual,
    fallback: r.fallback === true,
    fallbackCode: typeof r.fallback_code === 'string' ? r.fallback_code : null,
    action,
    passed: r.passed,
    reward: r.reward,
    catastrophic: r.catastrophic === true,
    licenseLevel: toStr(r.license_level),
    createdAt: toStr(r.created_at),
    persistedRecordId: toStr(r.id) || null,
    versionMismatch,
    source: 'insforge',
  }
}

/** In-memory record -> EvidenceItem (always current versions, so compatible). */
function memToItem(record: RunRecord): EvidenceItem {
  const t = record.trace
  return {
    traceId: t.id,
    episodeIndex: t.episode,
    runSequence: record.runSequence,
    scenarioId: t.scenario.id,
    scenarioTitle: t.scenario.title,
    requestedPolicyMode: t.provenance?.requestedPolicyMode ?? t.decision.source,
    actualPolicySource: t.decision.source,
    fallback: t.provenance?.fallback ?? false,
    fallbackCode: t.provenance?.fallbackCode ?? null,
    action: t.decision.action,
    passed: t.result.passed,
    reward: t.result.reward,
    catastrophic: t.result.catastrophic,
    licenseLevel: record.licenseLevel,
    createdAt: record.createdAt,
    persistedRecordId: record.persistedId,
    versionMismatch: false,
    source: 'memory',
  }
}

/** Merge in-memory + rehydrated items, deduped by traceId (memory wins). */
export function mergeDedupe(mem: EvidenceItem[], rehydrated: EvidenceItem[]): EvidenceItem[] {
  const byId = new Map<string, EvidenceItem>()
  for (const it of mem) byId.set(it.traceId, it)
  for (const it of rehydrated) if (!byId.has(it.traceId)) byId.set(it.traceId, it)
  return [...byId.values()].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
    return b.runSequence - a.runSequence
  })
}

/** EvidenceItem -> browser-safe compact row (no snapshots / inputs). */
export function compactFromItem(it: EvidenceItem): CompactRun {
  return {
    traceId: it.traceId,
    episodeIndex: it.episodeIndex,
    runSequence: it.runSequence,
    scenarioId: it.scenarioId,
    scenarioTitle: it.scenarioTitle,
    requestedPolicyMode: it.requestedPolicyMode,
    actualPolicySource: it.actualPolicySource,
    fallback: it.fallback,
    fallbackCode: it.fallbackCode,
    action: it.action,
    passed: it.passed,
    reward: it.reward,
    catastrophic: it.catastrophic,
    licenseLevel: it.licenseLevel,
    createdAt: it.createdAt,
    versionMismatch: it.versionMismatch,
  }
}

/**
 * Compact server evidence status — backend proof that survives a client reload.
 * Rehydrates from InsForge at most once, dedupes by traceId, and recomputes the
 * current license ONLY from version-compatible authoritative verdicts.
 */
export async function getEvidenceStatus(cfg: RunEpisodeConfig): Promise<EvidenceStatus> {
  const configured = insforgeConfigured(cfg.insforge)

  // Rehydrate once.
  if (!rehydrationDone) {
    rehydrationDone = true
    if (configured) {
      const read = await fetchRecentEvidence(cfg.insforge, 100)
      readOutcomeStatus = read.status
      if (read.status === 'ok') {
        const memIds = new Set(serverRecords.map((r) => r.trace.id))
        const seen = new Set<string>()
        rehydratedItems = read.rows
          .map(parseEvidenceRow)
          .filter((it): it is EvidenceItem => it !== null)
          // drop rows already represented in this process, and intra-batch dupes
          .filter((it) => {
            if (memIds.has(it.traceId) || seen.has(it.traceId)) return false
            seen.add(it.traceId)
            return true
          })
      }
    }
  }

  const memItems = serverRecords.map(memToItem)
  const combined = mergeDedupe(memItems, rehydratedItems)
  const compatible = combined.filter((it) => !it.versionMismatch)
  const versionMismatchCount = combined.length - compatible.length

  // Current license: recompute from compatible authoritative verdicts only —
  // never blend version-incompatible evidence, never trust a stored summary.
  const license =
    compatible.length > 0
      ? computeLicenseFromVerdicts(
          compatible.map((it) => ({
            passed: it.passed,
            reward: it.reward,
            catastrophic: it.catastrophic,
          })),
        )
      : null

  // historySource reflects where the picture came from.
  let historySource: HistorySource
  if (!configured) {
    historySource = 'memory' // in-memory only; never persisted (also see persistence.status)
    if (combined.length === 0) historySource = 'local_only'
  } else if (readOutcomeStatus === 'unavailable') {
    historySource = 'unavailable'
  } else if (readOutcomeStatus === 'error') {
    historySource = 'error'
  } else if (rehydratedItems.length > 0) {
    historySource = 'insforge'
  } else {
    historySource = 'memory'
  }

  const latest = combined[0]
  const latestPersisted =
    combined.find((it) => it.persistedRecordId)?.persistedRecordId ?? null

  return {
    runId: currentRunId(),
    serverEpisodeCount: combined.length,
    currentLicenseSummary: license
      ? {
          level: license.level.id,
          name: license.level.name,
          passRate: license.passRate,
          avgReward: license.avgReward,
          catastrophicCount: license.catastrophicCount,
          episodes: license.episodes,
        }
      : null,
    latestServerTraceId: latest?.traceId ?? null,
    latestPersistedRecordId: latestPersisted,
    historySource,
    rehydratedFromInsForge: rehydratedItems.length > 0,
    rehydratedCount: rehydratedItems.length,
    versionMismatchCount,
    compatibleEvidenceCount: compatible.length,
    persistence: {
      configured,
      status: configured ? 'configured' : 'local_only',
      table: INSFORGE_TABLE,
    },
    recentCompactRuns: combined.slice(0, 5).map(compactFromItem),
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
