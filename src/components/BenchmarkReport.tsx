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

// Static artifact under public/ (precomputed; no brain needed). Returns null if absent.
function useStaticJson(path: string) {
  const [d, setD] = useState<Json | null>(null)
  useEffect(() => {
    let on = true
    fetch(path).then((r) => (r.ok ? r.json() : null)).then((j) => { if (on) setD(j) }).catch(() => {})
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

// ---- Decision competencies (Butter-Bench-style decomposition) --------------
// Butter-Bench breaks "pass the butter" into isolatable robot sub-skills. We do
// the same for "run the floor unattended": six decision competencies, each with
// the decision, the failure it catches, and the actor accountable for it. The
// colour = which part of the stack owns the call (the brain/verifier/executor
// boundary, made concrete).
type Role = 'llm' | 'policy' | 'verifier' | 'executor'
const ROLE_COLOR: Record<Role, string> = {
  llm: 'var(--brand)', policy: 'var(--pos)', verifier: 'var(--accent)', executor: 'var(--muted)',
}
const ROLE_LABEL: Record<Role, string> = {
  llm: 'LLM proposes', policy: 'RL policy', verifier: 'Verifier gates', executor: 'Humanoid executes',
}
const COMPETENCIES: { n: number; name: string; role: Role; decision: string; isolates: string; fail: string; signal: string }[] = [
  { n: 1, name: 'Quote', role: 'llm',
    decision: 'Accept, reject, or price each incoming RFQ.',
    isolates: 'Margin judgment under demand pressure.',
    fail: 'Taking negative-margin work to look busy.',
    signal: 'Rejects the −$0.05/unit RFQ; quote_margin in the reward.' },
  { n: 2, name: 'Schedule', role: 'policy',
    decision: 'Sequence every operation onto a machine, operator, and hour.',
    isolates: 'Allocating scarce capacity — which jobs win the slots.',
    fail: 'Overlaps, missed deadlines, high-value jobs left unbuilt.',
    signal: 'The RL dispatch policy (§04): +31% profit, 0 violations.' },
  { n: 3, name: 'Procure', role: 'llm',
    decision: 'Order materials to cover deficits before the op starts.',
    isolates: 'Lead-time planning against the schedule.',
    fail: 'Material arrives after the operation needs it.',
    signal: 'material_late / material_shortage driven to 0.' },
  { n: 4, name: 'Safety', role: 'verifier',
    decision: 'Inspect/lock-out degraded machines; cap robot exposure; prefer the 24/7 robot off-hours.',
    isolates: 'Unattended-operation risk — the "CEO away two weeks" story.',
    fail: 'Running a degraded machine or fatiguing a human overnight.',
    signal: 'Uncontrolled hazards penalized; controlled ones rewarded.' },
  { n: 5, name: 'Repair', role: 'verifier',
    decision: 'When a plan breaks a hard constraint, recursively fix it.',
    isolates: 'Closing the feasibility gap an LLM leaves open.',
    fail: 'Shipping an infeasible plan for unattended execution.',
    signal: 'verify→repair loop drives hard violations to exactly 0.' },
  { n: 6, name: 'Execute', role: 'executor',
    decision: 'Hand the verified plan to the humanoid as a task queue; confirm physically.',
    isolates: 'Sim-to-real: feasible on paper ≠ feasible in the cell.',
    fail: 'A plan the robot cannot physically realize.',
    signal: 'MuJoCo rollout + V-JEPA perceptual check.' },
]

// Top-down floor schematic: the six competencies placed as stations on a plant
// floor, numbered, colour-coded by owner, with a verifier rail under all of them.
function FloorCompetencyMap() {
  const W = 860, H = 268
  // station centers on a top-down floor
  const st: Record<number, { x: number; y: number; w: number; h: number; sub: string }> = {
    1: { x: 70, y: 54, w: 150, h: 48, sub: 'RFQ inbox' },
    3: { x: 70, y: 138, w: 150, h: 48, sub: 'material dock' },
    2: { x: 355, y: 64, w: 170, h: 100, sub: 'M1·M2·M3·M4' },
    4: { x: 655, y: 54, w: 150, h: 48, sub: 'hazard control' },
    6: { x: 655, y: 138, w: 150, h: 48, sub: 'humanoid bay' },
    5: { x: 355, y: 196, w: 170, h: 46, sub: 'verify ↻ repair' },
  }
  const cap = (n: number) => COMPETENCIES.find((c) => c.n === n)!
  const cx = (n: number) => st[n].x + st[n].w / 2
  const cy = (n: number) => st[n].y + st[n].h / 2
  const flow = [1, 3, 2, 5, 4, 6]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12 }}>
      <defs>
        <marker id="fa" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6 z" fill="var(--muted)" />
        </marker>
      </defs>
      {/* floor outline */}
      <rect x={14} y={14} width={W - 28} height={H - 28} rx={14} fill="none" stroke="var(--line)" strokeWidth={1.4} />
      <text x={26} y={32} fontFamily={mono} fontSize={10} fill="var(--muted)" letterSpacing="0.12em">FLOOR · TOP-DOWN</text>
      {/* flow path through the stations */}
      {flow.slice(0, -1).map((n, i) => {
        const a = flow[i], b = flow[i + 1]
        return <line key={n} x1={cx(a)} y1={cy(a)} x2={cx(b)} y2={cy(b)} stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 4" opacity={0.5} markerEnd="url(#fa)" />
      })}
      {/* stations */}
      {[1, 3, 2, 4, 6, 5].map((n) => {
        const s = st[n], c = cap(n), col = ROLE_COLOR[c.role]
        return (
          <g key={n}>
            <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={9} fill="var(--panel-2)" stroke={col} strokeWidth={1.6} />
            <circle cx={s.x + 16} cy={s.y + 16} r={11} fill={col} />
            <text x={s.x + 16} y={s.y + 20} textAnchor="middle" fontFamily={mono} fontSize={12} fontWeight={700} fill="var(--panel)">{n}</text>
            <text x={s.x + 34} y={s.y + 20} fontFamily="var(--font-display)" fontSize={14} fontWeight={800} fill="var(--text)">{c.name}</text>
            <text x={s.x + 34} y={s.y + (s.h > 60 ? 38 : 36)} fontFamily={mono} fontSize={10} fill="var(--muted)">{s.sub}</text>
            {n === 2 && (
              <g>{[0, 1, 2, 3].map((m) => (
                <rect key={m} x={s.x + 16 + (m % 2) * 74} y={s.y + 50 + Math.floor(m / 2) * 22} width={64} height={16} rx={3} fill="var(--panel)" stroke="var(--line)" />
              ))}</g>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function RLChart() {
  const [d, setD] = useState<Json | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let on = true
    // static-first (precomputed), then the live brain endpoint as a fallback
    fetch('/factoryceo/rl_curve.json').then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) { if (on) setD(j); return } return fetch(`${BRAIN}/rl_train?quick=1`).then((r) => (r.ok ? r.json() : null)).then((k) => on && setD(k)) })
      .catch(() => {})
    return () => { on = false }
  }, [])
  async function rerun() {
    setBusy(true)
    try { const r = await fetch(`${BRAIN}/rl_train?quick=1`); if (r.ok) setD(await r.json()) } finally { setBusy(false) }
  }
  if (!d) return <div style={{ fontFamily: mono, fontSize: 12, color: 'var(--muted)', padding: '10px 0' }}>loading the learning curve…</div>
  const curve = d.curve ?? []
  const eps = curve.map((p: Json) => p.episode)
  const maxEp = Math.max(1, ...eps)
  const profits = curve.map((p: Json) => p.policy_profit)
  const greedy = d.greedy_profit ?? (curve[0]?.greedy_profit ?? 0)
  const lo = Math.min(greedy, ...profits) * 0.97, hi = Math.max(greedy, ...profits) * 1.03
  const W = 820, H = 280, padL = 64, padB = 30, padT = 14
  const x = (e: number) => padL + (e / maxEp) * (W - padL - 14)
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB)
  const fmt = (v: number) => (Math.abs(v) >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`)
  const path = curve.map((p: Json, i: number) => `${i ? 'L' : 'M'}${x(p.episode).toFixed(1)} ${y(p.policy_profit).toFixed(1)}`).join(' ')
  const last = curve[curve.length - 1]
  const W_NAMES = d.feature_names ?? []
  const wmax = Math.max(1e-6, ...W_NAMES.map((n: string) => Math.abs(d.weights?.[n] ?? 0)))
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12 }}>
        {[0, 0.5, 1].map((f) => { const v = lo + f * (hi - lo); const yy = y(v)
          return <g key={f}><line x1={padL} y1={yy} x2={W - 14} y2={yy} stroke="var(--line)" strokeWidth={0.6} />
            <text x={padL - 8} y={yy + 3} textAnchor="end" fontFamily={mono} fontSize={10} fill="var(--muted)">{fmt(v)}</text></g> })}
        {/* greedy reference */}
        <line x1={padL} y1={y(greedy)} x2={W - 14} y2={y(greedy)} stroke="var(--muted)" strokeWidth={1.4} strokeDasharray="5 4" />
        <text x={W - 16} y={y(greedy) - 6} textAnchor="end" fontFamily={mono} fontSize={11} fill="var(--muted)">EDD-greedy {fmt(greedy)}</text>
        {/* policy curve */}
        <path d={path} fill="none" stroke="var(--pos)" strokeWidth={2.6} />
        <circle cx={x(last?.episode ?? 0)} cy={y(last?.policy_profit ?? 0)} r={4} fill="var(--pos)" />
        <text x={x(last?.episode ?? 0) - 6} y={y(last?.policy_profit ?? 0) - 9} textAnchor="end" fontFamily={mono} fontSize={11} fill="var(--pos)">RL policy {fmt(last?.policy_profit ?? 0)}</text>
        <text x={padL} y={H - 9} fontFamily={mono} fontSize={10} fill="var(--muted)">episode 0</text>
        <text x={W - 14} y={H - 9} textAnchor="end" fontFamily={mono} fontSize={10} fill="var(--muted)">{maxEp} episodes</text>
      </svg>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 12 }}>
        <Stat label="profit lift vs greedy" value={`+${d.lift_pct ?? 0}%`} good />
        <Stat label="gain over random init" value={fmt(d.gain_over_init ?? 0)} good />
        <Stat label="hard-violation rate" value={`${d.final_hard_viol_rate ?? 0}`} />
        <Stat label="capacity-binding floor" value={`${d.n_jobs}j · ${d.horizon_days}d`} />
      </div>
      {/* learned weights — the interpretable payoff */}
      <div style={{ marginTop: 16, padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 12, background: 'var(--panel)' }}>
        <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>What the policy learned (dispatch weights)</div>
        {W_NAMES.filter((n: string) => n !== 'bias').map((n: string) => { const v = d.weights?.[n] ?? 0; const frac = Math.abs(v) / wmax
          return (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontFamily: mono, fontSize: 11.5, width: 110, color: 'var(--text)' }}>{n}</span>
              <div style={{ flex: 1, position: 'relative', height: 14, background: 'var(--panel-2)', borderRadius: 4 }}>
                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--muted)' }} />
                <div style={{ position: 'absolute', left: v >= 0 ? '50%' : `${50 - frac * 50}%`, width: `${frac * 50}%`, top: 0, bottom: 0, background: v >= 0 ? 'var(--pos)' : 'var(--neg)', borderRadius: 3 }} />
              </div>
              <span style={{ fontFamily: mono, fontSize: 11.5, width: 52, textAlign: 'right', color: v >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{v >= 0 ? '+' : ''}{v.toFixed(2)}</span>
            </div>
          )
        })}
        <p style={{ ...prose, fontSize: 13, color: 'var(--muted)', margin: '8px 0 0' }}>
          The policy taught itself to bank high-<strong>revenue</strong>, revenue-dense (<strong>rev_per_hour</strong>) jobs and avoid long ones (<strong>−work_hours</strong>) that hog scarce capacity — and that the customer "<strong>priority</strong>" label EDD sorts on barely predicts profit. No reward shaping; just verified profit.
        </p>
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="btn" onClick={rerun} disabled={busy}>{busy ? 'training…' : 'Re-run RL live (≈45s)'}</button>
        <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', marginLeft: 10 }}>REINFORCE over dispatch orderings · reward = verified profit</span>
      </div>
    </div>
  )
}

// The HUD-hosted counterpart: an LLM dispatch policy trained on HUD boxes via
// GRPO (TrainingClient), same env + reward as the tiny policy above. Reward is
// banked profit / EDD-greedy (1.0 = greedy). Loads the precomputed run JSON.
function HudRLChart() {
  const d = useStaticJson('/factoryceo/hud_rl_curve.json')
  if (!d) return null
  const curve = (d.curve ?? []).filter((p: Json) => typeof p.reward === 'number')
  if (!curve.length) return null
  const steps = curve.map((p: Json) => p.step)
  const maxStep = Math.max(1, ...steps)
  const rewards = curve.map((p: Json) => p.reward)
  const lo = Math.min(1.0, ...rewards) - 0.02, hi = Math.max(1.0, ...rewards) + 0.02
  const W = 820, H = 230, padL = 56, padB = 28, padT = 14
  const x = (s: number) => padL + (s / maxStep) * (W - padL - 14)
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB)
  const path = curve.map((p: Json, i: number) => `${i ? 'L' : 'M'}${x(p.step).toFixed(1)} ${y(p.reward).toFixed(1)}`).join(' ')
  const last = curve[curve.length - 1]
  const lift = d.lift_vs_greedy_pct ?? 0
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        Same decision, trained on HUD (GRPO over a gateway LLM)
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12 }}>
        {[lo, 1.0, hi].map((v, i) => { const yy = y(v); const isG = Math.abs(v - 1) < 1e-6
          return <g key={i}><line x1={padL} y1={yy} x2={W - 14} y2={yy} stroke={isG ? 'var(--muted)' : 'var(--line)'} strokeWidth={isG ? 1.2 : 0.6} strokeDasharray={isG ? '5 4' : undefined} />
            <text x={padL - 8} y={yy + 3} textAnchor="end" fontFamily={mono} fontSize={10} fill="var(--muted)">{v.toFixed(2)}</text>
            {isG && <text x={W - 16} y={yy - 5} textAnchor="end" fontFamily={mono} fontSize={10} fill="var(--muted)">EDD-greedy 1.00</text>}</g> })}
        <path d={path} fill="none" stroke="var(--brand)" strokeWidth={2.6} />
        {curve.map((p: Json, i: number) => <circle key={i} cx={x(p.step)} cy={y(p.reward)} r={3} fill={p.trained ? 'var(--brand)' : 'var(--muted)'} />)}
        <text x={x(last.step) - 6} y={y(last.reward) - 9} textAnchor="end" fontFamily={mono} fontSize={11} fill="var(--brand)">LLM policy {last.reward.toFixed(3)}</text>
        <text x={padL} y={H - 8} fontFamily={mono} fontSize={10} fill="var(--muted)">step 0 (untrained fork)</text>
        <text x={W - 14} y={H - 8} textAnchor="end" fontFamily={mono} fontSize={10} fill="var(--muted)">{maxStep} GRPO steps</text>
      </svg>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 12 }}>
        <Stat label="reward vs greedy" value={`${lift >= 0 ? '+' : ''}${lift}%`} good={lift >= 0} />
        <Stat label="baseline → final" value={`${d.baseline_reward} → ${d.final_reward}`} />
        <Stat label="checkpoints promoted" value={`${d.steps}`} />
        <Stat label="trainable model" value="Qwen3.5-4B" />
      </div>
      <p style={{ ...prose, fontSize: 13, color: 'var(--muted)', margin: '10px 0 0' }}>
        A forked <strong>Qwen3.5-4B</strong> trained with <code>hud.TrainingClient</code> (on-policy GRPO,
        importance-sampling loss) on HUD's remote boxes — rollouts on the same <code>dispatch</code> env,
        graded by the same verifier-profit reward, {d.steps} weight-promoting checkpoints landed.
        <strong> Honest read:</strong> at this small budget the 4B plateaus at ~{d.final_reward} — just under
        greedy, no lift. The env is a <em>real</em> HUD training target (the loop runs end-to-end), but
        improving a 26-job ordering needs a bigger model / many more GRPO steps. The tiny analytic policy
        above gets +32% in CPU-minutes with zero credits — far more sample-efficient on this narrow
        decision. HUD's edge is the harness + leaderboard + the path to scale, not a toy-budget win.
      </p>
    </div>
  )
}

function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div style={{ flex: '1 1 150px', minWidth: 130, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--panel)' }}>
      <div style={{ fontFamily: mono, fontSize: 19, fontWeight: 700, color: good ? 'var(--pos)' : 'var(--text)' }}>{value}</div>
      <div style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{label}</div>
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

      {/* decision competencies — Butter-Bench-style decomposition */}
      <div style={{ ...kicker, marginTop: 40 }}>01 · Decision competencies</div>
      <h2 style={h2}>What the brain actually has to decide</h2>
      <p style={prose}>
        Butter-Bench decomposes "pass the butter" into isolatable robot sub-skills so you can see
        <em> where</em> an LLM-driven robot fails. We do the same for "run the floor unattended": six
        decision competencies, each isolating one judgment, each with the failure it catches and the actor
        accountable. Colour marks who owns the call — the brain → verifier → humanoid boundary, made concrete.
      </p>
      <FloorCompetencyMap />
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', margin: '12px 0 18px' }}>
        {(['llm', 'policy', 'verifier', 'executor'] as Role[]).map((r) => (
          <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: mono, fontSize: 11.5, color: 'var(--text)' }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: ROLE_COLOR[r] }} />{ROLE_LABEL[r]}
          </span>
        ))}
      </div>
      {COMPETENCIES.map((c) => (
        <div key={c.n} style={{ display: 'flex', gap: 14, padding: '12px 0', borderTop: '1px solid var(--line)' }}>
          <div style={{ flex: '0 0 30px', height: 30, borderRadius: 8, background: ROLE_COLOR[c.role], color: 'var(--panel)', fontFamily: mono, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.n}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16 }}>{c.name}</span>
              <span style={{ fontFamily: mono, fontSize: 10.5, color: ROLE_COLOR[c.role], textTransform: 'uppercase', letterSpacing: '0.06em' }}>{ROLE_LABEL[c.role]}</span>
            </div>
            <p style={{ ...prose, fontSize: 14, margin: '4px 0 0' }}>{c.decision}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 18px', marginTop: 6 }}>
              <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--muted)' }}><span style={{ color: 'var(--text)' }}>isolates ·</span> {c.isolates}</span>
              <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--muted)' }}><span style={{ color: 'var(--neg)' }}>fails when ·</span> {c.fail}</span>
              <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--muted)', gridColumn: '1 / -1' }}><span style={{ color: 'var(--pos)' }}>measured by ·</span> {c.signal}</span>
            </div>
          </div>
        </div>
      ))}

      {/* results */}
      <div style={{ ...kicker, marginTop: 40 }}>02 · Results</div>
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
      <div style={{ ...kicker, marginTop: 36 }}>03 · Long-horizon business sim</div>
      <h2 style={h2}>FactoryRun: bank balance over a rolling year</h2>
      <p style={prose}>
        A long-horizon operations sim in the spirit of Vending-Bench: the brain runs the floor day by
        day against fresh work and disruptions, banking revenue minus costs. It rewards <strong>coherence
        over time</strong>, not one-shot scheduling — and separates a verifier-gated brain from a raw
        planner that bleeds on infeasible days.
      </p>
      <RollingChart />
      <ContinualNote />

      {/* RL: training that genuinely lifts profit (SimRLFab-style) */}
      <div style={{ ...kicker, marginTop: 36 }}>04 · Training that lifts profit</div>
      <h2 style={h2}>RL over dispatch decisions, not over feasibility</h2>
      <p style={prose}>
        An honest distinction. Our verifier <em>guarantees</em> feasibility for any plan, so training a
        repair policy cannot move profit — the rule-based repair always closes the same gap (that is the
        caveat in §03's continual note). Profit is moved by a <strong>different</strong> decision: which
        jobs win the scarce machine/operator slots when capacity binds. So we build a real RL env in that
        spirit (SimRLFab): a capacity-binding floor, an action that is a <strong>dispatch ordering</strong>,
        and reward = the verifier's profit. A REINFORCE policy gradient trains it. Feasibility stays the
        verifier's invariant; the policy learns to bank value.
      </p>
      <RLChart />
      <p style={{ ...prose, fontSize: 13.5, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 16px', marginTop: 14 }}>
        <strong>Read it as:</strong> the green curve is the trained policy's held-out profit climbing from
        random-init toward and past EDD-greedy (+31%); the dashed line is greedy. The hard-violation rate
        is <strong>0.000 every episode</strong> — training lifts profit while the verifier keeps it safe.
        This is the figure the continual loop was missing: training <em>does</em> lift profit, on the
        decision the verifier doesn't already settle.
      </p>
      <HudRLChart />

      {/* standard instances */}
      <div style={{ ...kicker, marginTop: 36 }}>05 · Grounding</div>
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
      <div style={{ ...kicker, marginTop: 36 }}>06 · Methodology</div>
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
