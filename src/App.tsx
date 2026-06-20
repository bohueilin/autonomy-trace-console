import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { decide, toMockView } from './agent'
import { fetchNebiusAction } from './nebiusClient'
import { fetchEvidenceStatus } from './serverEpisodeClient'
import { buildGymTrace, observationToModelView, resetGymEpisode, stepGymEpisode } from './gymClient'
import { computeLicense } from './license'
import { seedScenarios } from './seedScenarios'
import { verify } from './verifier'
import type {
  AgentDecision,
  AgentSource,
  EvidencePolicySource,
  EvidenceStatus,
  PersistenceStatus,
  Scenario,
  Trace,
  TraceProvenance,
} from './types'
import { ScenarioCard } from './components/ScenarioCard'
import { AgentActionCard } from './components/AgentActionCard'
import { VerifierCard } from './components/VerifierCard'
import { LicenseSummary } from './components/LicenseSummary'
import { TraceViewer } from './components/TraceViewer'
import { EvidencePanel } from './components/EvidencePanel'

const FALLBACK_MSG = 'Nebius unavailable — using local policy fallback for demo reliability.'

function App() {
  const [traces, setTraces] = useState<Trace[]>([])
  const [cursor, setCursor] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [mode, setMode] = useState<AgentSource>('mock')
  const [running, setRunning] = useState(false)

  // Server-owned evidence state.
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>('idle')
  const [evidence, setEvidence] = useState<EvidenceStatus | null>(null)
  const [backendReached, setBackendReached] = useState(false)

  const license = useMemo(() => computeLicense(traces), [traces])
  const active = traces.length > 0 ? traces[traces.length - 1] : null

  const nebiusModel = useMemo(
    () => [...traces].reverse().find((t) => t.decision.source === 'nebius')?.decision.model,
    [traces],
  )

  // Pull the compact server evidence status — backend proof that survives a
  // client reload (run id, episode count, latest ids) rather than only React state.
  function refreshEvidence() {
    fetchEvidenceStatus()
      .then((status) => {
        if (status) {
          setEvidence(status)
          setBackendReached(true)
        }
      })
      .catch(() => {})
  }

  useEffect(refreshEvidence, [])

  function buildTrace(scenario: Scenario, episode: number, decision: AgentDecision): Trace {
    const result = verify(scenario, decision)
    const signal = result.catastrophic
      ? 'caps license'
      : result.passed
        ? 'builds trust'
        : 'erodes trust'
    return {
      id: `ep-${episode}-${scenario.id}`,
      episode,
      scenario,
      decision,
      result,
      licenseSignal: signal,
      authority: 'demo_client_trace',
      displayIndex: episode,
    }
  }

  // Canonical single-episode path: drive the `/v1` gym env. The reference agent
  // (mock or Nebius) only PROPOSES an action from the returned observation; the
  // ENVIRONMENT verifies it, scores it, and computes the license. The browser
  // runs no verifier/license math for this path — it renders what `/v1` returns.
  async function runGymEpisode() {
    if (running) return
    setRunning(true)
    setNotice(null)
    setPersistenceStatus('saving')
    try {
      const scenario = seedScenarios[cursor % seedScenarios.length]
      const agentId = mode === 'nebius' ? 'nebius-reference' : 'mock-reference'
      const reset = await resetGymEpisode(scenario.id, agentId)

      // Reference agent proposes an action from the observation only.
      let decision: AgentDecision
      let actualSource: EvidencePolicySource = 'mock'
      let fellBack = false
      if (mode === 'nebius') {
        try {
          decision = await fetchNebiusAction(observationToModelView(reset.observation))
          actualSource = 'nebius'
        } catch {
          decision = decide(toMockView(scenario))
          fellBack = true
        }
      } else {
        decision = decide(toMockView(scenario))
      }

      // The environment is the verifier/license authority — send only the action.
      const step = await stepGymEpisode(reset.episodeId, decision.action)

      const provenance: TraceProvenance = {
        requestedPolicyMode: mode,
        actualPolicySource: actualSource,
        fallback: fellBack,
        fallbackCode: fellBack ? 'nebius_unavailable' : null,
      }
      setTraces((prev) => [
        ...prev,
        { ...buildGymTrace(scenario, decision, step, provenance), displayIndex: prev.length + 1 },
      ])
      setCursor((c) => c + 1)
      setPersistenceStatus(step.persisted ? 'saved' : 'local_only')
      if (fellBack) setNotice(FALLBACK_MSG)
      refreshEvidence()
    } catch {
      setPersistenceStatus('unavailable')
      setNotice('Gym episode unavailable — check the server and try again.')
    } finally {
      setRunning(false)
    }
  }

  // Full 9-episode eval — intentionally MOCK-ONLY and client-side for reliability.
  function runFullEval() {
    if (running) return
    setNotice(null)
    try {
      const fresh = seedScenarios.map((s, i) => buildTrace(s, i + 1, decide(toMockView(s))))
      setTraces(fresh)
      setCursor(seedScenarios.length)
    } catch {
      setNotice('Could not run the eval. The loop was left unchanged — try again.')
    }
  }

  function reset() {
    if (running) return
    setTraces([])
    setCursor(0)
    setNotice(null)
  }

  const primaryLabel = running
    ? mode === 'nebius'
      ? 'Running Nebius…'
      : 'Running…'
    : mode === 'nebius'
      ? 'Run 1 Nebius Gym Episode'
      : 'Run Gym Episode'

  const mutValue =
    mode === 'nebius' ? nebiusModel ?? 'Nebius Token Factory' : 'Mock Policy (local)'

  return (
    <div className="console">
      <header className="topbar">
        <div className="brand">
          <h1>Autonomy Trace Console</h1>
          <p className="tagline">Agents should earn autonomy before they exercise it.</p>
          <p className="future">warm-up for → Autonomy License Gym</p>
        </div>

        <div
          className="license-chip"
          style={{ borderColor: license.level.color }}
          aria-label={`Current autonomy license: ${license.level.id} ${license.level.name}`}
        >
          <span className="chip-badge" style={{ background: license.level.color }}>
            {license.level.id}
          </span>
          <span className="chip-text">
            <span className="chip-eyebrow">Autonomy license</span>
            <span className="chip-name" style={{ color: license.level.color }}>
              {license.level.name}
            </span>
          </span>
        </div>

        <div className="runner">
          <div className="mode-row">
            <div className="mode-toggle" role="group" aria-label="Agent mode">
              <button
                className={mode === 'mock' ? 'on' : ''}
                aria-pressed={mode === 'mock'}
                onClick={() => setMode('mock')}
              >
                Mock Policy
              </button>
              <button
                className={mode === 'nebius' ? 'on' : ''}
                aria-pressed={mode === 'nebius'}
                onClick={() => setMode('nebius')}
              >
                Nebius Policy
              </button>
            </div>
            <div className={`mut-badge ${mode === 'nebius' ? 'mut-nebius' : ''}`}>
              <span className="mut-label">Model under test</span>
              <span className="mut-value">{mutValue}</span>
            </div>
          </div>

          <div className="controls">
            <button
              className="btn primary"
              onClick={runGymEpisode}
              disabled={running}
              aria-label={
                mode === 'nebius'
                  ? 'Run one Nebius gym episode through the /v1 environment'
                  : 'Run a single gym episode through the /v1 environment'
              }
            >
              <span aria-hidden="true">▶</span> {primaryLabel}
              <span className="server-tag">/v1 · evidence</span>
            </button>
            <button
              className="btn"
              onClick={runFullEval}
              disabled={running}
              aria-label="Run the full nine-episode evaluation with the mock policy"
            >
              <span aria-hidden="true">⏩</span> Run 9-Episode Eval
              <span className="mock-tag">mock</span>
            </button>
            <button
              className="btn ghost"
              onClick={reset}
              disabled={running}
              aria-label="Reset the console"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      {notice && <div className="notice">{notice}</div>}

      <div className="layout">
        <main className="main-col">
          <section className="episode-flow">
            <h2 className="section-title">
              Current episode{' '}
              {active && (
                <span className="muted">
                  · #{active.displayIndex ?? active.episode} — {active.scenario.title}
                  {active.authority === 'server_authoritative_episode' && (
                    <span className="auth-tag auth-server">server-authoritative</span>
                  )}
                </span>
              )}
            </h2>
            {active ? (
              <div className="flow-grid">
                <ScenarioCard scenario={active.scenario} revealed={true} />
                <AgentActionCard decision={active.decision} />
                <VerifierCard result={active.result} />
              </div>
            ) : (
              <div className="empty-flow">
                <p>Run an episode to watch the loop:</p>
                <p className="loop-line">scenario → action → verifier → reward → license signal</p>
              </div>
            )}
          </section>

          <section className="trace-section">
            <TraceViewer traces={traces} />
          </section>
        </main>

        <aside className="side-col">
          <LicenseSummary license={license} />
          <EvidencePanel status={persistenceStatus} evidence={evidence} reached={backendReached} />
          <div className="scenario-bank">
            <div className="bank-head">Scenario bank · {seedScenarios.length} seeded</div>
            <ul>
              {seedScenarios.map((s, i) => {
                const isNext = i === cursor % seedScenarios.length
                return (
                  <li key={s.id} className={isNext ? 'next' : ''}>
                    <span className={`dot domain-${s.domain}`} />
                    {s.title}
                    {isNext && <span className="next-tag">next</span>}
                  </li>
                )
              })}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default App
