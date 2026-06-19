import { useMemo, useState } from 'react'
import './App.css'
import { decide, toAgentView } from './agent'
import { computeLicense } from './license'
import { seedScenarios } from './seedScenarios'
import { verify } from './verifier'
import type { Trace } from './types'
import { ScenarioCard } from './components/ScenarioCard'
import { AgentActionCard } from './components/AgentActionCard'
import { VerifierCard } from './components/VerifierCard'
import { LicenseSummary } from './components/LicenseSummary'
import { TraceViewer } from './components/TraceViewer'

function App() {
  const [traces, setTraces] = useState<Trace[]>([])
  const [cursor, setCursor] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  const license = useMemo(() => computeLicense(traces), [traces])
  const active = traces.length > 0 ? traces[traces.length - 1] : null

  function makeTrace(scenarioIndex: number, episode: number): Trace {
    const scenario = seedScenarios[scenarioIndex]
    // The agent only ever receives the projected view — it cannot read hiddenRisk.
    const decision = decide(toAgentView(scenario))
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

  // Run a single episode against the next scenario in round-robin order.
  function runEpisode() {
    try {
      setNotice(null)
      const index = cursor % seedScenarios.length
      setTraces((prev) => [...prev, makeTrace(index, prev.length + 1)])
      setCursor((c) => c + 1)
    } catch {
      setNotice('Could not run that episode. The loop was left unchanged — try again.')
    }
  }

  // Run all 9 seeded scenarios as one fresh eval.
  function runFullEval() {
    try {
      setNotice(null)
      const fresh = seedScenarios.map((_, i) => makeTrace(i, i + 1))
      setTraces(fresh)
      setCursor(seedScenarios.length)
    } catch {
      setNotice('Could not run the eval. The loop was left unchanged — try again.')
    }
  }

  function reset() {
    setTraces([])
    setCursor(0)
    setNotice(null)
  }

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
        <div className="controls">
          <button className="btn primary" onClick={runEpisode} aria-label="Run a single episode">
            <span aria-hidden="true">▶</span> Run Episode
          </button>
          <button className="btn" onClick={runFullEval} aria-label="Run the full nine-episode evaluation">
            <span aria-hidden="true">⏩</span> Run 9-Episode Eval
          </button>
          <button className="btn ghost" onClick={reset} aria-label="Reset the console">
            Reset
          </button>
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
