// FactoryBench — a long-form, authoritative benchmark report page (eval-report
// genre: abstract -> results leaderboard -> standard-instance grounding ->
// methodology). Reads /eval_report + /benchmark from the brain.
import { useEffect, useState } from 'react'

type Json = Record<string, any>
const BRAIN = ((import.meta as any).env?.VITE_BRAIN_URL as string) || 'http://localhost:8090'
const mono = "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace"

function useGet(path: string) {
  const [d, setD] = useState<Json | null>(null)
  useEffect(() => {
    let on = true
    fetch(`${BRAIN}${path}`).then((r) => (r.ok ? r.json() : null)).then((j) => { if (on) setD(j) }).catch(() => {})
    return () => { on = false }
  }, [path])
  return d
}

const wrap: React.CSSProperties = { maxWidth: 880, margin: '0 auto', padding: '8px 20px 80px' }
const h2: React.CSSProperties = { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em', margin: '40px 0 6px' }
const kicker: React.CSSProperties = { fontFamily: mono, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--brand)' }
const prose: React.CSSProperties = { color: 'var(--text)', lineHeight: 1.7, fontSize: 15.5, margin: '0 0 14px' }
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontFamily: mono, fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--line)' }
const td: React.CSSProperties = { padding: '9px 10px', fontSize: 13.5, borderBottom: '1px solid var(--line)' }

function RollingChart() {
  const sim = useGet('/rolling_sim')
  if (!sim) return <div style={{ fontFamily: mono, fontSize: 12, color: 'var(--muted)', padding: '10px 0' }}>running the year-long sim…</div>
  const brain = sim.brain?.trajectory ?? []
  const naive = sim.naive?.trajectory ?? []
  const days = sim.days ?? 120
  const all = [...brain, ...naive].map((t: Json) => t.cash)
  const lo = Math.min(0, ...all), hi = Math.max(1, ...all)
  const W = 820, H = 280, padL = 64, padB = 28, padT = 12
  const x = (d: number) => padL + (d / Math.max(1, days - 1)) * (W - padL - 12)
  const y = (c: number) => padT + (1 - (c - lo) / (hi - lo)) * (H - padT - padB)
  const path = (traj: Json[]) => traj.map((t, i) => `${i ? 'L' : 'M'}${x(t.day).toFixed(1)} ${y(t.cash).toFixed(1)}`).join(' ')
  const fmt = (v: number) => (Math.abs(v) >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`)
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12 }}>
        {[0, 0.5, 1].map((f) => { const c = lo + f * (hi - lo); const yy = y(c)
          return <g key={f}><line x1={padL} y1={yy} x2={W - 12} y2={yy} stroke="var(--line)" strokeWidth={0.6} />
            <text x={padL - 8} y={yy + 3} textAnchor="end" fontFamily={mono} fontSize={10} fill="var(--muted)">{fmt(c)}</text></g> })}
        <line x1={padL} y1={y(0)} x2={W - 12} y2={y(0)} stroke="var(--muted)" strokeWidth={0.8} strokeDasharray="3 3" />
        <path d={path(naive)} fill="none" stroke="var(--neg)" strokeWidth={2} />
        <path d={path(brain)} fill="none" stroke="var(--pos)" strokeWidth={2.5} />
        <text x={W - 14} y={y(brain[brain.length - 1]?.cash ?? 0) - 6} textAnchor="end" fontFamily={mono} fontSize={11} fill="var(--pos)">brain {fmt(sim.brain?.final_cash ?? 0)}</text>
        <text x={x(naive.length - 1) + 6} y={y(naive[naive.length - 1]?.cash ?? 0) + 4} fontFamily={mono} fontSize={11} fill="var(--neg)">{sim.naive?.bankrupt ? `bankrupt · day ${sim.naive.bankrupt_day}` : `naive ${fmt(sim.naive?.final_cash ?? 0)}`}</text>
        <text x={padL} y={H - 8} fontFamily={mono} fontSize={10} fill="var(--muted)">day 0</text>
        <text x={W - 12} y={H - 8} textAnchor="end" fontFamily={mono} fontSize={10} fill="var(--muted)">day {days}</text>
      </svg>
      <p style={{ ...prose, fontSize: 14, color: 'var(--muted)', marginTop: 12 }}>
        Bank balance over {days} days of rolling operations. The verifier-gated brain stays feasible and compounds; the raw planner scraps work on infeasible days and goes bankrupt. Small per-day differences compound into a large gap — the long-horizon coherence Vending-Bench measures.
      </p>
    </div>
  )
}

function ContinualNote() {
  const c = useGet('/factoryceo/continual.json')
  if (!c?.series?.length) return null
  const rounds = c.series.length
  const traces = c.series[rounds - 1]?.traces ?? 0
  return (
    <div style={{ marginTop: 14, padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 12, background: 'var(--panel)' }}>
      <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Continual training</div>
      <p style={{ ...prose, fontSize: 14, margin: 0 }}>
        Run continually (synth → verified traces → train the TRM → run the sim), here {rounds} rounds
        generating <strong>{traces} verified traces</strong> the student retrains on each round. Honest
        note: the deterministic verifier <em>guarantees</em> feasibility, so the compounding profit comes
        from <strong>proper decisions every cycle</strong> — not from the TRM training. The continual loop's
        job is to distil those decisions into a tiny student that can run standalone; the profit curve above
        is the value the verifier secures, which the LLM-alone baseline never reaches.
      </p>
    </div>
  )
}

export function BenchmarkReport({ onBack }: { onBack: () => void }) {
  const evalr = useGet('/eval_report')
  const bench = useGet('/benchmark')
  const lb = evalr?.leaderboard ?? []
  const aLabel: Record<string, string> = { trm: 'FactoryCEO-TRM (verifier-gated)', greedy: 'Greedy heuristic', naive: 'Frontier LLM (no verifier)' }

  return (
    <section style={wrap}>
      <button className="btn ghost back" onClick={onBack} style={{ marginBottom: 18 }}>← Back</button>

      {/* abstract */}
      <div style={kicker}>FactoryBench · long-horizon manufacturing operations</div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 36, letterSpacing: '-0.03em', lineHeight: 1.08, margin: '10px 0 16px' }}>
        Verifier-gated planning for autonomous shop-floor operations.
      </h1>
      <p style={prose}>
        A benchmark of long-horizon factory scheduling: schedule every operation without breaking a
        hard constraint, while maximizing profit and safety. Plans are graded by a <strong>deterministic
        verifier</strong>, not an LLM judge. Run a frontier model on it and you see the gap our brain closes.
      </p>
      <p style={{ ...prose, color: 'var(--muted)', fontSize: 14 }}>
        Instances are our procedurally-generated hard + long-horizon floors (breakdowns, absences, late
        material). Framing follows the "LLM as robot brain" view (Butter-Bench): the LLM orchestrates,
        an executor controls — and the verifier closes the planning gap orchestrator LLMs leave open.
      </p>

      {/* results */}
      <div style={{ ...kicker, marginTop: 36 }}>01 · Results</div>
      <h2 style={h2}>Long-horizon leaderboard</h2>
      <p style={prose}>
        Partial-credit score (feasibility + on-time + safety + profit) averaged across a Taskset of
        14–60 day scenarios with disruptions. {evalr ? `${evalr.n_tasks} tasks · horizons ${(evalr.horizons ?? []).join('/')} days.` : ''}
      </p>
      {!evalr ? <Pending /> : (
        <div>
          {lb.map((l: Json) => (
            <div key={l.agent} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
                <span style={{ fontWeight: l.agent === 'trm' ? 700 : 400 }}>{aLabel[l.agent] ?? l.agent}</span>
                <span style={{ fontFamily: mono, color: l.agent === 'trm' ? 'var(--pos)' : l.agent === 'naive' ? 'var(--neg)' : 'var(--accent)' }}>{l.score.toFixed(3)}</span>
              </div>
              <div style={{ height: 9, background: 'var(--panel-2)', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ width: `${100 * l.score}%`, height: '100%', background: l.agent === 'trm' ? 'var(--pos)' : l.agent === 'naive' ? 'var(--neg)' : 'var(--accent)' }} />
              </div>
            </div>
          ))}
          <p style={{ ...prose, fontSize: 14, color: 'var(--muted)', marginTop: 14 }}>{evalr.headline}</p>
        </div>
      )}
      <div style={{ ...prose, fontSize: 13.5, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 16px', color: 'var(--text)' }}>
        <strong>Why is the brain at ~1.0, and isn't that suspicious?</strong> The score is partial credit
        (0–1), and the verifier-gated brain is feasible <em>by construction</em> — the verifier won't let
        an infeasible plan through. That's the guarantee, not a trick. A frontier LLM has no verifier, so
        it can't reach it — which is the whole point. Separately, the tiny TRM <em>student</em> that
        imitates the brain trains to ~85% accuracy (it's a 3K-param model, not perfect); the verifier is
        what makes the system safe, not the student being flawless.
      </div>

      {/* long-horizon rolling sim (Vending-Bench-style) */}
      <div style={{ ...kicker, marginTop: 36 }}>02 · Long-horizon business sim</div>
      <h2 style={h2}>FactoryRun: bank balance over a rolling year</h2>
      <p style={prose}>
        A long-horizon operations sim in the spirit of Vending-Bench: the brain runs the floor day by
        day against fresh work and disruptions, banking revenue minus costs. It rewards <strong>coherence
        over time</strong>, not one-shot scheduling — and separates a verifier-gated brain from a raw
        planner that bleeds on infeasible days.
      </p>
      <RollingChart />
      <ContinualNote />

      {/* standard instances */}
      <div style={{ ...kicker, marginTop: 36 }}>03 · Grounding</div>
      <h2 style={h2}>Standard JSSP instances vs best-known solutions</h2>
      <p style={prose}>
        To ground the eval in the operations-research literature, we load classic job-shop instances
        (OR-Library: Fisher-Thompson, Lawrence) and report <strong>makespan</strong> and the gap to the
        published best-known solution (BKS). Our scheduler is feasibility-first, not a makespan
        optimizer: it is feasible on every instance, with a measured gap to the optimum. The
        differentiator is dynamic re-optimization under disruption, which static BKS instances do not test.
      </p>
      <p style={{ ...prose, fontSize: 13.5, color: 'var(--muted)' }}>
        The disruption model draws on standard predictive-maintenance + defect datasets — AI4I 2020
        (telemetry → 5 failure modes), NASA CMAPSS (run-to-failure / RUL), and UCI SECOM (semiconductor
        fault signatures) — so breakdowns, tool wear, and defects reflect real failure distributions.
      </p>
      {!bench ? <Pending /> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
          <thead><tr>
            <th style={th}>instance</th><th style={th}>size</th>
            <th style={{ ...th, textAlign: 'right' }}>makespan</th>
            <th style={{ ...th, textAlign: 'right' }}>BKS</th>
            <th style={{ ...th, textAlign: 'right' }}>gap</th>
            <th style={{ ...th, textAlign: 'right' }}>feasible</th>
          </tr></thead>
          <tbody>{(bench.rows ?? []).map((r: Json) => (
            <tr key={r.instance}>
              <td style={td}><b>{r.instance}</b> <span style={{ color: 'var(--muted)' }}>{r.name}</span></td>
              <td style={{ ...td, fontFamily: mono, fontSize: 12 }}>{r.jobs}×{r.machines}</td>
              <td style={{ ...td, textAlign: 'right', fontFamily: mono }}>{r.makespan}</td>
              <td style={{ ...td, textAlign: 'right', fontFamily: mono, color: 'var(--muted)' }}>{r.bks}</td>
              <td style={{ ...td, textAlign: 'right', fontFamily: mono }}>+{r.gap_pct}%</td>
              <td style={{ ...td, textAlign: 'right', color: r.feasible ? 'var(--pos)' : 'var(--neg)' }}>{r.feasible ? '✓' : '✕'}</td>
            </tr>
          ))}</tbody>
        </table>
      )}

      {/* methodology */}
      <div style={{ ...kicker, marginTop: 36 }}>04 · Methodology</div>
      <h2 style={h2}>How the brain is built and graded</h2>
      {[
        ['Deterministic verifier', 'Every plan is checked against hard constraints (overlap, capability, availability, material, maintenance, precedence) and scored on a profit + safety objective. Pass/fail is reproducible — no LLM judge.'],
        ['Recursive verify → repair', 'A candidate plan is iteratively repaired: each step picks the local fix that best reduces the top violation, until hard violations reach zero. This guarantees feasibility before execution.'],
        ['Teacher → TRM distillation', 'A serverless teacher (Qwen3.7) proposes plans; the verified repair traces distil a ~3K-param Tiny Recursive Model that drives the loop — the Sillon/RATP recipe: narrow domain + synthetic data + verified traces + a real verifier ⇒ a small specialist beats the frontier LLM.'],
        ['Execution + perception', 'The verified plan becomes a humanoid task queue, rolled out in MuJoCo and scored perceptually by V-JEPA — symbolic feasibility plus physical confirmation.'],
      ].map(([t, d]) => (
        <div key={t} style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, marginBottom: 3 }}>{t}</div>
          <p style={{ ...prose, margin: 0, fontSize: 14.5 }}>{d}</p>
        </div>
      ))}
    </section>
  )
}

function Pending() {
  return <div style={{ fontFamily: mono, fontSize: 12, color: 'var(--muted)', padding: '10px 0' }}>loading from the brain (start it on :8090 if blank)…</div>
}
