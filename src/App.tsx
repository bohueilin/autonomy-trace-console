import { useMemo, useState } from 'react'
import './App.css'
import { decide, toMockView, toModelView } from './agent'
import { fetchNebiusAction } from './nebiusClient'
import { computeLicense } from './license'
import { seedScenarios } from './seedScenarios'
import { verify } from './verifier'
import type { AgentDecision, AgentSource, Scenario, Trace } from './types'
import { ScenarioCard } from './components/ScenarioCard'
import { AgentActionCard } from './components/AgentActionCard'
import { VerifierCard } from './components/VerifierCard'
import { LicenseSummary } from './components/LicenseSummary'
import { TraceViewer } from './components/TraceViewer'

const FALLBACK_MSG = 'Nebius unavailable — using local policy fallback for demo reliability.'

function App() {
  const [traces, setTraces] = useState<Trace[]>([])
  const [cursor, setCursor] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [mode, setMode] = useState<AgentSource>('mock')
  const [running, setRunning] = useState(false)

  const license = useMemo(() => computeLicense(traces), [traces])
  const active = traces.length > 0 ? traces[traces.length - 1] : null

  // The model name surfaced once a Nebius decision has come back at least once.
  const nebiusModel = useMemo(
    () => [...traces].reverse().find((t) => t.decision.source === 'nebius')?.decision.model,
    [traces],
  )

  function buildTrace(scenario: Scenario, episode: number, decision: AgentDecision): Trace {
    // The verifier is the source of truth — it scores `decision.action` regardless
    // of whether the mock policy or the Nebius model produced it.
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
    }
  }

  // Produce a decision for one scenario. In Nebius mode, call the server; on any
  // failure fall back to the deterministic mock policy so the demo never stalls.
  async function decideFor(
    scenario: Scenario,
  ): Promise<{ decision: AgentDecision; fellBack: boolean }> {
    if (mode === 'nebius') {
      try {
        // The model receives the ModelPolicyView only (no visibleRiskScore).
        return { decision: await fetchNebiusAction(toModelView(scenario)), fellBack: false }
      } catch {
        return { decision: decide(toMockView(scenario)), fellBack: true }
      }
    }
    return { decision: decide(toMockView(scenario)), fellBack: false }
  }

  // Run a single episode against the next scenario in round-robin order.
  // Uses the selected mode (Nebius = one real model call, with mock fallback).
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

  // Run all 9 seeded scenarios as one fresh eval. Intentionally MOCK-ONLY: the
  // headline eval stays instant and deterministic for demo reliability. Use
  // "Run 1 Nebius Episode" to exercise the real model one scenario at a time.
  function runFullEval() {
    if (running) return
    setNotice(null)
    try {
      const fresh = seedScenarios.map((s, i) =>
        buildTrace(s, i + 1, decide(toMockView(s))),
      )
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
              {active && <span className="muted">· #{active.episode} — {active.scenario.title}</span>}
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
