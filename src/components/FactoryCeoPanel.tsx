// FactoryCEO-TRM panel: the human CEO leaves a mess; the brain plans, the verifier
// gates, the recursive TRM repairs to a safe verified solution, and the humanoid
// executes it. Plus the baseline: a frontier LLM out of the box can't do this
// safely. Loads pre-computed run artifacts from /public/factoryceo/*.json.
import { useEffect, useMemo, useRef, useState } from 'react'

type Json = Record<string, any>

const card: React.CSSProperties = {
  background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12,
  padding: '16px 18px', marginBottom: 16,
}
const eyebrow: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--accent)', marginBottom: 8, fontWeight: 500,
}
const mono = "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace"

function useJson(url: string) {
  const [data, setData] = useState<Json | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData).catch((e) => setErr(String(e)))
  }, [url])
  return { data, err }
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <span style={{
      fontFamily: mono, fontSize: 11.5, border: `1px solid ${tone ?? 'var(--line)'}`,
      color: tone ?? 'var(--text)', borderRadius: 5, padding: '3px 7px',
      display: 'inline-block', marginRight: 6, marginBottom: 6,
    }}>{children}</span>
  )
}

// ---- baseline: frontier LLM vs FactoryCEO-TRM ----
function Baseline({ b }: { b: Json }) {
  const hm = b.headline_metrics ?? {}
  const raw = hm.frontier_llm_raw ?? {}
  const trm = hm.factoryceo_trm ?? {}
  const lb: Json[] = b.hud_leaderboard ?? []
  const maxR = Math.max(...lb.map((x) => x.reward), 1)
  return (
    <div style={{ ...card, borderColor: 'var(--neg)' }}>
      <div style={eyebrow}>Baseline — why a frontier LLM alone isn't enough</div>
      <p style={{ margin: '0 0 14px', color: 'var(--text)' }}>{b.headline}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
            HUD leaderboard · same task, graded by the verifier
          </div>
          {lb.map((x, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text)' }}>{x.agent}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 10, background: 'var(--line)', borderRadius: 5 }}>
                  <div style={{
                    width: `${(100 * x.reward) / maxR}%`, height: '100%', borderRadius: 5,
                    background: x.reward > 0.5 ? 'var(--pos)' : 'var(--neg)',
                  }} />
                </div>
                <span style={{ fontFamily: mono, fontSize: 12, minWidth: 40 }}>{x.reward.toFixed(3)}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{x.note}</div>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
            30-day run · frontier raw vs FactoryCEO-TRM
          </div>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead><tr style={{ color: 'var(--muted)', fontFamily: mono, fontSize: 11 }}>
              <th style={{ textAlign: 'left', padding: '4px 8px' }} />
              <th style={{ padding: '4px 8px' }}>frontier raw</th>
              <th style={{ padding: '4px 8px' }}>TRM</th>
            </tr></thead>
            <tbody>
              <tr><td style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--muted)' }}>invalid actions</td>
                <td style={{ padding: '6px 8px', color: 'var(--neg)' }}>{raw.invalid_actions}</td>
                <td style={{ padding: '6px 8px', color: 'var(--pos)' }}>{trm.invalid_actions}</td></tr>
              <tr><td style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--muted)' }}>customer trust</td>
                <td style={{ padding: '6px 8px', color: 'var(--neg)' }}>{raw.customer_trust}</td>
                <td style={{ padding: '6px 8px', color: 'var(--pos)' }}>{trm.customer_trust}</td></tr>
              <tr><td style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--muted)' }}>unsafe incidents</td>
                <td style={{ padding: '6px 8px', color: 'var(--neg)' }}>{raw.unsafe_incidents}</td>
                <td style={{ padding: '6px 8px', color: 'var(--pos)' }}>{trm.unsafe_incidents}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', margin: '14px 0 6px' }}>
        raw-LLM failure modes
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text)' }}>
        {(b.raw_llm_failure_modes ?? []).map((f: string, i: number) => <li key={i} style={{ marginBottom: 3 }}>{f}</li>)}
      </ul>
    </div>
  )
}

// ---- the recursive verify -> repair stepper ----
function RepairStepper({ ep }: { ep: Json }) {
  const steps = useMemo(() => {
    const s = [{ viol: ep.verifier_before?.n_hard ?? 0, reward: ep.verifier_before?.reward ?? 0, action: null as Json | null }]
    for (const t of ep.repair_trace ?? []) {
      s.push({ viol: (t.errors_after ?? []).length, reward: t.reward_after, action: t.repair_action })
    }
    return s
  }, [ep])
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const timer = useRef<number | null>(null)
  useEffect(() => {
    if (!playing) return
    timer.current = window.setInterval(() => {
      setI((p) => { if (p >= steps.length - 1) { setPlaying(false); return p } return p + 1 })
    }, 420)
    return () => { if (timer.current) window.clearInterval(timer.current) }
  }, [playing, steps.length])
  const cur = steps[i]
  const maxViol = steps[0].viol || 1
  const a = cur.action
  const desc = !a ? 'raw plan — before any repair'
    : `${a.op}${a.job_id ? ` · ${a.job_id}/${a.operation_id ?? ''}` : ''}${a.machine_id ? ` → ${a.machine_id}/${a.operator_id ?? ''}` : ''}${a.material ? ` · ${a.material}` : ''}`
  return (
    <div style={card}>
      <div style={eyebrow}>Recursive verify → repair (the TRM loop)</div>
      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 34, color: cur.viol === 0 ? 'var(--pos)' : 'var(--neg)' }}>{cur.viol}</div>
          <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)' }}>HARD VIOLATIONS</div>
        </div>
        <div>
          <div style={{ fontFamily: mono, fontSize: 34, color: 'var(--accent)' }}>{Math.round(cur.reward).toLocaleString()}</div>
          <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)' }}>VERIFIER REWARD</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn ghost" onClick={() => { setPlaying(false); setI(0) }}>reset</button>
          <button className="btn primary" onClick={() => { if (i >= steps.length - 1) setI(0); setPlaying((p) => !p) }}>
            {playing ? '❚❚ pause' : '▶ play repair'}
          </button>
        </div>
      </div>
      <div style={{ height: 10, background: 'var(--line)', borderRadius: 5, margin: '10px 0 6px', overflow: 'hidden' }}>
        <div style={{ width: `${(100 * cur.viol) / maxViol}%`, height: '100%', background: cur.viol === 0 ? 'var(--pos)' : 'var(--neg)', transition: 'width .25s' }} />
      </div>
      <input type="range" min={0} max={steps.length - 1} value={i}
        onChange={(e) => { setPlaying(false); setI(Number(e.target.value)) }} style={{ width: '100%', accentColor: 'var(--accent)' }} />
      <div style={{ fontFamily: mono, fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
        {i === 0 ? `raw plan (step 0 / ${steps.length - 1})` : `after repair ${i} / ${steps.length - 1}`}
      </div>
      <div style={{ fontFamily: mono, fontSize: 13, marginTop: 10, padding: '10px 12px', borderLeft: '3px solid var(--accent)', background: 'rgba(108,140,255,0.08)' }}>{desc}</div>
    </div>
  )
}

// ---- humanoid execution timeline ----
function Humanoid({ tasks }: { tasks: Json }) {
  const rq = tasks.robot_queues ?? {}
  const entries = Object.entries(rq) as [string, Json[]][]
  if (!entries.length) return null
  const all = entries.flatMap(([, q]) => q)
  const lo = Math.min(...all.map((t) => t.start_hr))
  const hi = Math.max(...all.map((t) => t.end_hr))
  const span = hi - lo || 1
  return (
    <div style={card}>
      <div style={eyebrow}>Humanoid executes the verified plan</div>
      <div style={{ fontFamily: mono, fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
        verified={String(tasks.meta?.verified)} · {tasks.meta?.safety_incidents ?? 0} safety incidents
        {(tasks.safety_controls ?? []).map((s: Json, i: number) => (
          <span key={i} style={{ marginLeft: 8, color: 'var(--pos)', border: '1px solid var(--pos)', borderRadius: 5, padding: '1px 6px' }}>{s.control} {s.target}</span>
        ))}
      </div>
      {entries.map(([rid, q]) => (
        <div key={rid} style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{rid} (humanoid) — {q.length} tasks</div>
          <div style={{ position: 'relative', height: 24, background: 'rgba(108,140,255,0.06)', borderRadius: 6 }}>
            {q.map((t, i) => (
              <div key={i} title={`${t.task} @ ${t.machine} (h${t.start_hr}-${t.end_hr}, ${t.job})`} style={{
                position: 'absolute', top: 2, height: 20, borderRadius: 4,
                left: `${(100 * (t.start_hr - lo)) / span}%`,
                width: `${Math.max(3, (100 * (t.end_hr - t.start_hr)) / span)}%`,
                background: 'var(--accent)', color: '#0c0f17', fontFamily: mono, fontSize: 9,
                lineHeight: '20px', overflow: 'hidden', padding: '0 4px', whiteSpace: 'nowrap',
              }}>{t.machine}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Scoreboard({ rows }: { rows: Json[] }) {
  return (
    <div style={card}>
      <div style={eyebrow}>Scoreboard — 30-day run, averaged over scenarios</div>
      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
        <thead><tr style={{ color: 'var(--muted)', fontFamily: mono, fontSize: 11 }}>
          <th style={{ textAlign: 'left', padding: '6px 8px' }}>method</th>
          <th style={{ padding: '6px 8px' }}>profit</th><th style={{ padding: '6px 8px' }}>on-time</th>
          <th style={{ padding: '6px 8px' }}>invalid</th><th style={{ padding: '6px 8px' }}>trust</th>
          <th style={{ padding: '6px 8px' }}>unsafe</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => {
            const trm = r.method === 'trm'
            return (
              <tr key={r.method} style={{ borderTop: '1px solid var(--line)', fontWeight: trm ? 600 : 400 }}>
                <td style={{ textAlign: 'left', padding: '8px', color: trm ? 'var(--accent)' : 'var(--text)' }}>{r.label}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{Math.round(r.profit).toLocaleString()}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{Math.round(r.on_time_rate * 100)}%</td>
                <td style={{ padding: '8px', textAlign: 'right', color: r.invalid_actions === 0 ? 'var(--pos)' : 'var(--neg)' }}>{r.invalid_actions}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: r.customer_trust >= 90 ? 'var(--pos)' : 'var(--neg)' }}>{Math.round(r.customer_trust)}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: (r.safety_incidents ?? 0) === 0 ? 'var(--pos)' : 'var(--neg)' }}>{r.safety_incidents ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function FactoryCeoPanel() {
  const { data: run, err: runErr } = useJson('/factoryceo/run.json')
  const { data: baseline } = useJson('/factoryceo/baseline.json')
  const { data: tasks } = useJson('/factoryceo/isaac_tasks.json')
  if (runErr) return <div style={{ ...card, color: 'var(--neg)' }}>Could not load /factoryceo/run.json ({runErr}). Run <code>python run.py</code> in factoryceo_trm/ and copy results into public/factoryceo/.</div>
  if (!run) return <div style={{ ...card, color: 'var(--muted)' }}>Loading FactoryCEO run…</div>
  const ep = run.episode
  const fs = ep?.observation?.factory_state ?? {}
  return (
    <div>
      <div style={{ ...card, borderColor: 'var(--accent)' }}>
        <div style={eyebrow}>FactoryCEO-TRM · brain decides → verifier gates → humanoid executes</div>
        <h2 style={{ margin: '0 0 6px' }}>The CEO leaves for two weeks. The brain runs operations.</h2>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Messy plant context → compiled state → proposed plan → recursive TRM repair to a verified,
          safe solution → humanoid executes it. Any operational task plugs into the same loop.
        </p>
      </div>

      {baseline && <Baseline b={baseline} />}

      <div style={card}>
        <div style={eyebrow}>1 · Messy context the CEO leaves behind</div>
        <pre style={{ fontFamily: mono, fontSize: 12.5, whiteSpace: 'pre-wrap', margin: 0, color: 'var(--text)' }}>{ep?.observation?.messy_prompt}</pre>
      </div>

      <div style={card}>
        <div style={eyebrow}>2 · Compiled factory state</div>
        <div style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--muted)', margin: '4px 0' }}>machines</div>
        <div>{(fs.machines ?? []).map((m: Json) => <Chip key={m.id}>{m.id} · {m.capabilities?.join('/')}</Chip>)}</div>
        <div style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--muted)', margin: '8px 0 4px' }}>operators (human · robot)</div>
        <div>{(fs.operators ?? []).map((o: Json) => <Chip key={o.id} tone={o.type === 'robot' ? 'var(--accent)' : undefined}>{o.id} · {o.skills?.join('/')}</Chip>)}</div>
        <div style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--muted)', margin: '8px 0 4px' }}>jobs (showing {(fs.jobs ?? []).length})</div>
        <div>{(fs.jobs ?? []).map((j: Json) => <Chip key={j.id}>{j.id} · due d{j.due_day} · {j.operations?.length} ops</Chip>)}</div>
      </div>

      <RepairStepper ep={ep} />
      {tasks && <Humanoid tasks={tasks} />}
      <Scoreboard rows={run.scoreboard ?? []} />
    </div>
  )
}
