// FactoryCEO-TRM panel. The human CEO leaves a messy floor; the brain compiles it,
// plans, the verifier gates, the recursive TRM repairs to a verified safe plan, and
// the humanoid executes. Multi-modal input runs it on the USER'S own factory via the
// live brain (FastAPI). Styling takes cues from primeintellect.ai: dark, numbered
// uppercase mono labels, minimal borders, generous whitespace, terminal-like blocks.
import { useEffect, useMemo, useRef, useState } from 'react'

type Json = Record<string, any>
const BRAIN = ((import.meta as any).env?.VITE_BRAIN_URL as string) || 'http://localhost:8090'
const mono = "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace"

const card: React.CSSProperties = {
  background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14,
  padding: '22px 24px', marginBottom: 20,
}

function Label({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: 'var(--accent)' }}>{n}</span>
      <span style={{ width: 18, height: 1, background: 'var(--line)' }} />
      {children}
    </div>
  )
}

function useJson(url: string) {
  const [data, setData] = useState<Json | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(r.status))).then(setData).catch((e) => setErr(String(e)))
  }, [url])
  return { data, err }
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return <span style={{ fontFamily: mono, fontSize: 11.5, border: `1px solid ${tone ?? 'var(--line)'}`, color: tone ?? 'var(--text)', borderRadius: 6, padding: '4px 8px', display: 'inline-block', marginRight: 7, marginBottom: 7 }}>{children}</span>
}

// ---- multi-modal input: the user's own factory floor ----
function FactoryInput({ onResult }: { onResult: (r: Json) => void }) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<{ name: string; kind: string; content: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function addFiles(list: FileList | null) {
    if (!list) return
    const out: { name: string; kind: string; content: string }[] = []
    for (const f of Array.from(list)) {
      if (f.type.startsWith('image/')) out.push({ name: f.name, kind: 'image', content: '' })
      else out.push({ name: f.name, kind: 'text', content: await f.text() })
    }
    setFiles((p) => [...p, ...out])
  }

  async function run() {
    setBusy(true); setErr(null)
    try {
      const res = await fetch(`${BRAIN}/plan_from_input`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, files }),
      })
      if (!res.ok) throw new Error(String(res.status))
      onResult(await res.json())
    } catch {
      setErr(`Couldn't reach the brain at ${BRAIN}. Start it: cd factoryceo_trm && uvicorn api:app --port 8090 (set VITE_BRAIN_URL to override).`)
    } finally { setBusy(false) }
  }

  const sample = 'Automotive injection-molding + CNC shop. ~14 jobs this month — clips and brackets in ABS and Nylon, a few medical syringe runs in PP. M2 has been overheating. One operator out sick next week. Acme wants 10k clips by Friday at $0.18/unit.'
  return (
    <div style={{ ...card, borderColor: 'var(--accent)' }}>
      <Label n="00">Your factory floor — describe it, the brain plans it</Label>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6}
        placeholder="Paste RFQs, machine logs, operator notes, inventory — anything. The brain compiles it into a real, feasible factory and plans it."
        style={{ width: '100%', fontFamily: mono, fontSize: 13, lineHeight: 1.55, color: 'var(--text)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, padding: 12, resize: 'vertical', boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
        <button className="btn primary" onClick={run} disabled={busy}>{busy ? 'Compiling…' : '▶ Compile & plan'}</button>
        <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>📎 Add files</button>
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
        <button className="btn ghost" onClick={() => setText(sample)} disabled={busy}>use a sample</button>
        {files.map((f, i) => <Chip key={i} tone={f.kind === 'image' ? 'var(--warn)' : undefined}>{f.kind === 'image' ? '🖼 ' : '📄 '}{f.name}</Chip>)}
      </div>
      {err && <div style={{ marginTop: 10, color: 'var(--neg)', fontFamily: mono, fontSize: 12 }}>{err}</div>}
    </div>
  )
}

// ---- live floor plan: the CEO drag-selects (lasso) a region to optimize ----
type Rect = { x: number; y: number; w: number; h: number }

function layout(machines: Json[]): Record<string, { x: number; y: number; w: number; h: number }> {
  const cols = Math.max(1, Math.ceil(Math.sqrt(machines.length || 1)))
  const cellW = 150, cellH = 96, gap = 22, pad = 24, boxW = 110, boxH = 64
  const out: Record<string, { x: number; y: number; w: number; h: number }> = {}
  machines.forEach((m, i) => {
    const r = Math.floor(i / cols), c = i % cols
    out[m.id] = { x: pad + c * (cellW + gap) + (cellW - boxW) / 2, y: pad + r * (cellH + gap), w: boxW, h: boxH }
  })
  return out
}

function intersects(a: Rect, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function FloorPlanLasso({ machines, onResult }: { machines: Json[]; onResult: (r: Json) => void }) {
  const pos = useMemo(() => layout(machines), [machines])
  const cols = Math.max(1, Math.ceil(Math.sqrt(machines.length || 1)))
  const rows = Math.max(1, Math.ceil((machines.length || 1) / cols))
  const W = 24 * 2 + cols * 150 + (cols - 1) * 22
  const H = 24 * 2 + rows * 96
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const [sel, setSel] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function toLocal(e: React.PointerEvent) {
    const svg = svgRef.current!
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
    const m = svg.getScreenCTM()!.inverse()
    const p = pt.matrixTransform(m)
    return { x: p.x, y: p.y }
  }
  const rect = (d: NonNullable<typeof drag>): Rect => ({
    x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1),
    w: Math.abs(d.x1 - d.x0), h: Math.abs(d.y1 - d.y0),
  })
  function down(e: React.PointerEvent) {
    const { x, y } = toLocal(e); setDrag({ x0: x, y0: y, x1: x, y1: y }); setSel([])
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }
  function move(e: React.PointerEvent) {
    if (!drag) return
    const { x, y } = toLocal(e); setDrag({ ...drag, x1: x, y1: y })
    const r = rect({ ...drag, x1: x, y1: y })
    setSel(machines.filter((m) => intersects(r, pos[m.id])).map((m) => m.id))
  }
  function up() { if (drag && rect(drag).w * rect(drag).h < 40) setDrag(null) }

  async function optimize() {
    if (!sel.length) return
    setBusy(true); setErr(null)
    try {
      const res = await fetch(`${BRAIN}/optimize_region`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machine_ids: sel }),
      })
      if (!res.ok) throw new Error(String(res.status))
      onResult(await res.json())
    } catch {
      setErr(`Couldn't reach the brain at ${BRAIN}. Start it: cd factoryceo_trm && uvicorn api:app --port 8090.`)
    } finally { setBusy(false) }
  }

  const dr = drag ? rect(drag) : null
  return (
    <div style={{ ...card, borderColor: 'var(--accent)' }}>
      <Label n="00b">Live floor plan — lasso a region to optimize</Label>
      <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
        Drag a box across the stations you want the brain to focus on. The verifier + TRM optimize that region and the humanoid runs it.
      </p>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, touchAction: 'none', cursor: 'crosshair', userSelect: 'none' }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up}>
        {machines.map((m) => {
          const b = pos[m.id], on = sel.includes(m.id)
          return (
            <g key={m.id}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8}
                fill={on ? 'var(--accent)' : 'var(--panel)'} stroke={on ? 'var(--accent)' : 'var(--line)'} strokeWidth={1.5} opacity={on ? 0.92 : 1} />
              <text x={b.x + b.w / 2} y={b.y + 26} textAnchor="middle" fontFamily={mono} fontSize={14} fill={on ? '#0c0f17' : 'var(--text)'}>{m.id}</text>
              <text x={b.x + b.w / 2} y={b.y + 44} textAnchor="middle" fontFamily={mono} fontSize={9} fill={on ? '#0c0f17' : 'var(--muted)'}>{(m.capabilities ?? []).join('/')}</text>
            </g>
          )
        })}
        {dr && dr.w * dr.h >= 40 && (
          <rect x={dr.x} y={dr.y} width={dr.w} height={dr.h} fill="var(--accent)" fillOpacity={0.12} stroke="var(--accent)" strokeDasharray="5 4" strokeWidth={1.5} />
        )}
      </svg>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
        <button className="btn primary" onClick={optimize} disabled={busy || !sel.length}>{busy ? 'Optimizing…' : `▶ Optimize region (${sel.length})`}</button>
        {sel.length > 0 && <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--muted)' }}>selected: {sel.join(', ')}</span>}
      </div>
      {err && <div style={{ marginTop: 10, color: 'var(--neg)', fontFamily: mono, fontSize: 12 }}>{err}</div>}
    </div>
  )
}

function RegionResult({ region }: { region: Json }) {
  return (
    <div style={{ ...card, borderColor: region.verified ? 'var(--pos)' : 'var(--neg)' }}>
      <Label n="00c">Region optimized — {region.machine_ids?.join(', ')}</Label>
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div><div style={{ fontFamily: mono, fontSize: 30, color: region.verified ? 'var(--pos)' : 'var(--neg)' }}>{region.hard_violations}</div><div style={{ fontFamily: mono, fontSize: 10, color: 'var(--muted)' }}>HARD VIOLATIONS</div></div>
        <div><div style={{ fontFamily: mono, fontSize: 30, color: 'var(--accent)' }}>{region.n_ops}</div><div style={{ fontFamily: mono, fontSize: 10, color: 'var(--muted)' }}>OPS IN REGION</div></div>
        <div><div style={{ fontFamily: mono, fontSize: 30, color: 'var(--text)' }}>{(region.job_ids ?? []).length}</div><div style={{ fontFamily: mono, fontSize: 10, color: 'var(--muted)' }}>JOBS TOUCHED</div></div>
      </div>
      <div style={{ marginTop: 12 }}>{(region.job_ids ?? []).map((j: string) => <Chip key={j}>{j}</Chip>)}</div>
    </div>
  )
}

function Baseline({ b }: { b: Json }) {
  const hm = b.headline_metrics ?? {}, raw = hm.frontier_llm_raw ?? {}, trm = hm.factoryceo_trm ?? {}
  const lb: Json[] = b.hud_leaderboard ?? []
  const maxR = Math.max(...lb.map((x) => x.reward), 1)
  const cell = (v: any, good: boolean) => <td style={{ padding: '7px 8px', textAlign: 'right', color: good ? 'var(--pos)' : 'var(--neg)' }}>{v}</td>
  return (
    <div style={{ ...card, borderColor: 'var(--neg)' }}>
      <Label n="01">Baseline — why a frontier LLM alone isn't enough</Label>
      <p style={{ margin: '0 0 18px', color: 'var(--text)', lineHeight: 1.6 }}>{b.headline}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>HUD leaderboard · graded by the verifier</div>
          {lb.map((x, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text)', marginBottom: 4 }}>{x.agent}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 8, background: 'var(--bg)', borderRadius: 4 }}>
                  <div style={{ width: `${(100 * x.reward) / maxR}%`, height: '100%', borderRadius: 4, background: x.reward > 0.5 ? 'var(--pos)' : 'var(--neg)' }} />
                </div>
                <span style={{ fontFamily: mono, fontSize: 12.5, minWidth: 42 }}>{x.reward.toFixed(3)}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{x.note}</div>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>30-day run · raw frontier vs TRM</div>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead><tr style={{ color: 'var(--muted)', fontFamily: mono, fontSize: 10.5 }}>
              <th /><th style={{ padding: '4px 8px', textAlign: 'right' }}>frontier raw</th><th style={{ padding: '4px 8px', textAlign: 'right' }}>TRM</th></tr></thead>
            <tbody>
              <tr><td style={{ padding: '7px 8px', color: 'var(--muted)' }}>invalid actions</td>{cell(raw.invalid_actions, false)}{cell(trm.invalid_actions, true)}</tr>
              <tr><td style={{ padding: '7px 8px', color: 'var(--muted)' }}>customer trust</td>{cell(raw.customer_trust, false)}{cell(trm.customer_trust, true)}</tr>
              <tr><td style={{ padding: '7px 8px', color: 'var(--muted)' }}>unsafe incidents</td>{cell(raw.unsafe_incidents, false)}{cell(trm.unsafe_incidents, true)}</tr>
            </tbody>
          </table>
        </div>
      </div>
      <ul style={{ margin: '16px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--text)', lineHeight: 1.7 }}>
        {(b.raw_llm_failure_modes ?? []).map((f: string, i: number) => <li key={i}>{f}</li>)}
      </ul>
    </div>
  )
}

function RepairStepper({ ep, n }: { ep: Json; n: string }) {
  const steps = useMemo(() => {
    const s = [{ viol: ep.verifier_before?.n_hard ?? 0, reward: ep.verifier_before?.reward ?? 0, action: null as Json | null }]
    for (const t of ep.repair_trace ?? []) s.push({ viol: (t.errors_after ?? []).length, reward: t.reward_after, action: t.repair_action })
    return s
  }, [ep])
  const [i, setI] = useState(0); const [playing, setPlaying] = useState(false)
  const timer = useRef<number | null>(null)
  useEffect(() => { setI(0); setPlaying(false) }, [ep])
  useEffect(() => {
    if (!playing) return
    timer.current = window.setInterval(() => setI((p) => { if (p >= steps.length - 1) { setPlaying(false); return p } return p + 1 }), 420)
    return () => { if (timer.current) window.clearInterval(timer.current) }
  }, [playing, steps.length])
  const cur = steps[i], maxViol = steps[0].viol || 1, a = cur.action
  const desc = !a ? 'raw plan — before any repair' : `${a.op}${a.job_id ? ` · ${a.job_id}/${a.operation_id ?? ''}` : ''}${a.machine_id ? ` → ${a.machine_id}/${a.operator_id ?? ''}` : ''}${a.material ? ` · ${a.material}` : ''}`
  const big = (v: React.ReactNode, l: string, c: string) => (
    <div><div style={{ fontFamily: mono, fontSize: 36, lineHeight: 1, color: c }}>{v}</div><div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.06em', color: 'var(--muted)', marginTop: 6 }}>{l}</div></div>
  )
  return (
    <div style={card}>
      <Label n={n}>Recursive verify → repair (the TRM loop)</Label>
      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {big(cur.viol, 'HARD VIOLATIONS', cur.viol === 0 ? 'var(--pos)' : 'var(--neg)')}
        {big(Math.round(cur.reward).toLocaleString(), 'VERIFIER REWARD', 'var(--accent)')}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn ghost" onClick={() => { setPlaying(false); setI(0) }}>reset</button>
          <button className="btn primary" onClick={() => { if (i >= steps.length - 1) setI(0); setPlaying((p) => !p) }}>{playing ? '❚❚ pause' : '▶ play repair'}</button>
        </div>
      </div>
      <div style={{ height: 8, background: 'var(--bg)', borderRadius: 4, margin: '14px 0 8px', overflow: 'hidden' }}>
        <div style={{ width: `${(100 * cur.viol) / maxViol}%`, height: '100%', background: cur.viol === 0 ? 'var(--pos)' : 'var(--neg)', transition: 'width .25s' }} />
      </div>
      <input type="range" min={0} max={steps.length - 1} value={i} onChange={(e) => { setPlaying(false); setI(Number(e.target.value)) }} style={{ width: '100%', accentColor: 'var(--accent)' }} />
      <div style={{ fontFamily: mono, fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{i === 0 ? `raw plan (step 0 / ${steps.length - 1})` : `after repair ${i} / ${steps.length - 1}`}</div>
      <div style={{ fontFamily: mono, fontSize: 13, marginTop: 12, padding: '10px 12px', borderLeft: '2px solid var(--accent)', background: 'var(--bg)' }}>{desc}</div>
    </div>
  )
}

function Humanoid({ tasks, n }: { tasks: Json; n: string }) {
  const rq = tasks.robot_queues ?? {}
  const entries = Object.entries(rq) as [string, Json[]][]
  if (!entries.length) return null
  const all = entries.flatMap(([, q]) => q)
  const lo = Math.min(...all.map((t) => t.start_hr)), hi = Math.max(...all.map((t) => t.end_hr)), span = (hi - lo) || 1
  return (
    <div style={card}>
      <Label n={n}>Humanoid executes the verified plan</Label>
      <div style={{ fontFamily: mono, fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
        verified={String(tasks.meta?.verified)} · {tasks.meta?.safety_incidents ?? 0} safety incidents
        {(tasks.safety_controls ?? []).map((s: Json, i: number) => <span key={i} style={{ marginLeft: 8, color: 'var(--pos)', border: '1px solid var(--pos)', borderRadius: 5, padding: '1px 6px' }}>{s.control} {s.target}</span>)}
      </div>
      {entries.map(([rid, q]) => (
        <div key={rid} style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--muted)', marginBottom: 5 }}>{rid} (humanoid) — {q.length} tasks</div>
          <div style={{ position: 'relative', height: 24, background: 'var(--bg)', borderRadius: 6 }}>
            {q.map((t, i) => (
              <div key={i} title={`${t.task} @ ${t.machine} (h${t.start_hr}-${t.end_hr}, ${t.job})`} style={{ position: 'absolute', top: 3, height: 18, borderRadius: 4, left: `${(100 * (t.start_hr - lo)) / span}%`, width: `${Math.max(3, (100 * (t.end_hr - t.start_hr)) / span)}%`, background: 'var(--accent)', color: '#0c0f17', fontFamily: mono, fontSize: 9, lineHeight: '18px', overflow: 'hidden', padding: '0 4px', whiteSpace: 'nowrap' }}>{t.machine}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Scoreboard({ rows, n }: { rows: Json[]; n: string }) {
  return (
    <div style={card}>
      <Label n={n}>Scoreboard — 30-day run, averaged over scenarios</Label>
      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
        <thead><tr style={{ color: 'var(--muted)', fontFamily: mono, fontSize: 10.5 }}>
          <th style={{ textAlign: 'left', padding: '6px 8px' }}>method</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>profit</th>
          <th style={{ padding: '6px 8px', textAlign: 'right' }}>on-time</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>invalid</th>
          <th style={{ padding: '6px 8px', textAlign: 'right' }}>trust</th><th style={{ padding: '6px 8px', textAlign: 'right' }}>unsafe</th></tr></thead>
        <tbody>{rows.map((r) => {
          const trm = r.method === 'trm'
          return (
            <tr key={r.method} style={{ borderTop: '1px solid var(--line)', fontWeight: trm ? 600 : 400 }}>
              <td style={{ padding: '8px', color: trm ? 'var(--accent)' : 'var(--text)' }}>{r.label}</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>{Math.round(r.profit).toLocaleString()}</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>{Math.round(r.on_time_rate * 100)}%</td>
              <td style={{ padding: '8px', textAlign: 'right', color: r.invalid_actions === 0 ? 'var(--pos)' : 'var(--neg)' }}>{r.invalid_actions}</td>
              <td style={{ padding: '8px', textAlign: 'right', color: r.customer_trust >= 90 ? 'var(--pos)' : 'var(--neg)' }}>{Math.round(r.customer_trust)}</td>
              <td style={{ padding: '8px', textAlign: 'right', color: (r.safety_incidents ?? 0) === 0 ? 'var(--pos)' : 'var(--neg)' }}>{r.safety_incidents ?? '—'}</td>
            </tr>
          )
        })}</tbody>
      </table>
    </div>
  )
}

export function FactoryCeoPanel() {
  const { data: run, err: runErr } = useJson('/factoryceo/run.json')
  const { data: baseline } = useJson('/factoryceo/baseline.json')
  const { data: cannedTasks } = useJson('/factoryceo/isaac_tasks.json')
  const [live, setLive] = useState<Json | null>(null)

  const ep = live?.episode ?? run?.episode
  const tasks = live?.isaac_tasks ?? cannedTasks
  const fs = ep?.observation?.factory_state ?? {}
  const isLive = !!live

  return (
    <div>
      <div style={{ ...card, borderColor: 'var(--accent)', background: 'transparent' }}>
        <Label n="—">FactoryCEO-TRM · brain decides → verifier gates → humanoid executes</Label>
        <h2 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 500 }}>The CEO leaves for two weeks. The brain runs operations.</h2>
        <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.6 }}>Messy context → compiled state → proposed plan → recursive TRM repair to a verified, safe solution → humanoid executes it. Any operational task plugs into the same loop.</p>
      </div>

      <FactoryInput onResult={setLive} />
      {(fs.machines ?? []).length > 0 && <FloorPlanLasso machines={fs.machines} onResult={setLive} />}
      {live?.region && <RegionResult region={live.region} />}
      {baseline && <Baseline b={baseline} />}

      {!ep ? (
        <div style={{ ...card, color: runErr ? 'var(--neg)' : 'var(--muted)' }}>
          {runErr ? 'Load /factoryceo/run.json (run.py → public/factoryceo/) or compile your own factory above.' : 'Loading…'}
        </div>
      ) : (
        <>
          <div style={card}>
            <Label n="02">{isLive ? `Your factory — ${live.intake?.industry} · ${live.intake?.n_jobs} jobs (intake: ${live.intake?.source})` : 'Messy context the CEO leaves behind'}</Label>
            {isLive && live.intake?.summary && <p style={{ margin: '0 0 10px', color: 'var(--text)' }}>{live.intake.summary}</p>}
            <pre style={{ fontFamily: mono, fontSize: 12.5, whiteSpace: 'pre-wrap', margin: 0, color: 'var(--text)' }}>{ep.observation?.messy_prompt}</pre>
          </div>

          <div style={card}>
            <Label n="03">Compiled factory state</Label>
            <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--muted)', margin: '4px 0' }}>machines</div>
            <div>{(fs.machines ?? []).map((m: Json) => <Chip key={m.id}>{m.id} · {m.capabilities?.join('/')}</Chip>)}</div>
            <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--muted)', margin: '10px 0 4px' }}>operators (human · robot)</div>
            <div>{(fs.operators ?? []).map((o: Json) => <Chip key={o.id} tone={o.type === 'robot' ? 'var(--accent)' : undefined}>{o.id} · {o.skills?.join('/')}</Chip>)}</div>
            <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--muted)', margin: '10px 0 4px' }}>jobs (showing {(fs.jobs ?? []).length})</div>
            <div>{(fs.jobs ?? []).map((j: Json) => <Chip key={j.id}>{j.id} · due d{j.due_day} · {j.operations?.length} ops</Chip>)}</div>
          </div>

          <RepairStepper ep={ep} n="04" />
          {tasks && <Humanoid tasks={tasks} n="05" />}
        </>
      )}
      {run?.scoreboard && <Scoreboard rows={run.scoreboard} n="06" />}
    </div>
  )
}
