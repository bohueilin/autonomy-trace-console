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
        FactoryBench is built from our own procedurally-generated <strong>hard instances</strong> and
        <strong> long-horizon builds</strong> (14–60 day floors with breakdowns, absences, and late
        material). Each is an executable-plan task: schedule every operation without violating a single
        hard constraint — machine overlap, capability, operator availability, material arrival,
        maintenance, or precedence — while maximizing a profit-and-safety objective. Plans are graded
        by a <strong>deterministic verifier</strong>, not an LLM judge. Frontier models (Claude, GPT)
        can be run on the same instances; a frontier LLM alone emits infeasible or value-destroying
        plans, while a recursive verify→repair loop, distilled into a ~3K-parameter TRM, reaches zero
        violations on every horizon.
      </p>
      <p style={{ ...prose, color: 'var(--muted)', fontSize: 14 }}>
        Framing follows the "LLM as robot brain" view (Butter-Bench, Andon Labs): the LLM is the
        high-level <strong>orchestrator</strong>, paired with an <strong>executor</strong> for control.
        FactoryBench measures the orchestrator's practical intelligence — and the verifier is what
        closes the planning gap that orchestrator LLMs leave open.
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

      {/* standard instances */}
      <div style={{ ...kicker, marginTop: 36 }}>02 · Grounding</div>
      <h2 style={h2}>Standard JSSP instances vs best-known solutions</h2>
      <p style={prose}>
        To ground the eval in the operations-research literature, we load classic job-shop instances
        (OR-Library: Fisher-Thompson, Lawrence) and report <strong>makespan</strong> and the gap to the
        published best-known solution (BKS). Our scheduler is feasibility-first, not a makespan
        optimizer: it is feasible on every instance, with a measured gap to the optimum. The
        differentiator is dynamic re-optimization under disruption, which static BKS instances do not test.
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
      <div style={{ ...kicker, marginTop: 36 }}>03 · Methodology</div>
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
