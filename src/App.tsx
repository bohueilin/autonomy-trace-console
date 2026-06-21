import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { decide, toMockView, toModelView } from './agent'
import { fetchNebiusAction } from './nebiusClient'
import { fetchEvidenceStatus, runServerEpisode as postServerEpisode } from './serverEpisodeClient'
import { computeLicense } from './license'
import { seedScenarios } from './seedScenarios'
import { verify } from './verifier'
import type {
  AgentDecision,
  AgentSource,
  EvidenceStatus,
  PersistenceStatus,
  Scenario,
  Trace,
} from './types'
import { ScenarioCard } from './components/ScenarioCard'
import { AgentActionCard } from './components/AgentActionCard'
import { VerifierCard } from './components/VerifierCard'
import { LicenseSummary } from './components/LicenseSummary'
import { TraceViewer } from './components/TraceViewer'
import { EvidencePanel } from './components/EvidencePanel'
import { FactoryCeoPanel } from './components/FactoryCeoPanel'

const FALLBACK_MSG = 'Nebius unavailable — using local policy fallback for demo reliability.'

function App() {
  const [traces, setTraces] = useState<Trace[]>([])
  const [cursor, setCursor] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [mode, setMode] = useState<AgentSource>('mock')
  const [running, setRunning] = useState(false)
  const [view, setView] = useState<'gym' | 'factoryceo'>('gym')

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

  async function decideFor(
    scenario: Scenario,
  ): Promise<{ decision: AgentDecision; fellBack: boolean }> {
    if (mode === 'nebius') {
      try {
        return { decision: await fetchNebiusAction(toModelView(scenario)), fellBack: false }
      } catch {
        return { decision: decide(toMockView(scenario)), fellBack: true }
      }
    }
    return { decision: decide(toMockView(scenario)), fellBack: false }
  }

  // Local/demo single episode (client-authored trace).
  async function runEpisode() {
    if (running) return
    setRunning(true)
    setNotice(null)
    try {
      const index = cursor % seedScenarios.length
      const scenario = seedScenarios[index]
      const { decision, fellBack } = await decideFor(scenario)
      setTraces((prev) => [...prev, buildTrace(scenario, prev.length + 1, decision)])
      setCursor((c) => c + 1)
      if (fellBack) setNotice(FALLBACK_MSG)
    } catch {
      setNotice('Could not run that episode. The loop was left unchanged — try again.')
    } finally {
      setRunning(false)
    }
  }

  // Server-owned episode: the server loads the canonical scenario, runs the
  // policy + deterministic verifier, computes license, and persists evidence.
  // The client only sends { scenarioId, policyMode } and renders the result.
  async function runServerEpisode() {
    if (running) return
    setRunning(true)
    setNotice(null)
    setPersistenceStatus('saving')
    try {
      const scenario = seedScenarios[cursor % seedScenarios.length]
      const res = await postServerEpisode(scenario.id, mode)
      // Preserve the server-authoritative trace identity (id, episode, versions,
      // provenance). Only add a UI-only displayIndex for the mixed client list.
      setTraces((prev) => [...prev, { ...res.trace, displayIndex: prev.length + 1 }])
      setCursor((c) => c + 1)
      setPersistenceStatus(res.persistence.status)
      refreshEvidence()
    } catch {
      setPersistenceStatus('unavailable')
      setNotice('Server episode unavailable — the local demo still works. Try again.')
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
      ? 'Run 1 Nebius Episode'
      : 'Run Episode'

  const mutValue =
    mode === 'nebius' ? nebiusModel ?? 'Nebius Token Factory' : 'Mock Policy (local)'

  return (
    <div className="console">
      <header className="topbar">
        <div className="brand">
          <h1>Autonomy Trace Console</h1>
          <p className="tagline">Agents should earn autonomy before they exercise it.</p>
          <p className="future">warm-up for → Autonomy License Gym</p>
          <div className="mode-toggle" role="group" aria-label="View" style={{ marginTop: 8 }}>
            <button className={view === 'gym' ? 'on' : ''} aria-pressed={view === 'gym'} onClick={() => setView('gym')}>
              Autonomy Gym
            </button>
            <button className={view === 'factoryceo' ? 'on' : ''} aria-pressed={view === 'factoryceo'} onClick={() => setView('factoryceo')}>
              FactoryCEO
            </button>
          </div>
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
              onClick={runEpisode}
              disabled={running}
              aria-label={mode === 'nebius' ? 'Run one Nebius episode' : 'Run a single episode'}
            >
              <span aria-hidden="true">▶</span> {primaryLabel}
            </button>
            <button
              className="btn"
              onClick={runServerEpisode}
              disabled={running}
              aria-label="Run a server-owned episode and persist the evidence"
            >
              <span aria-hidden="true">🗄</span> Run Server Episode
              <span className="server-tag">evidence</span>
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

      {view === 'factoryceo' && (
        <div className="layout">
          <main className="main-col">
            <FactoryCeoPanel />
          </main>
        </div>
      )}

      {view === 'gym' && (
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
      )}
    </div>
  )
}

export default App
