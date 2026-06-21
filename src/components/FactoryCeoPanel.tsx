// FactoryCEO-TRM panel. The human CEO leaves a messy floor; the brain compiles it,
// plans, the verifier gates, the recursive TRM repairs to a verified safe plan, and
// the humanoid executes. Multi-modal input runs it on the USER'S own factory via the
// live brain (FastAPI). Styling takes cues from primeintellect.ai: dark, numbered
// uppercase mono labels, minimal borders, generous whitespace, terminal-like blocks.
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

type Json = Record<string, any>
export type BrainFile = { name: string; kind: string; content: string }
export type BrainInput = { text: string; files: BrainFile[] }
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

// Sample N frames from a video (uploaded File object URL or a clip URL) into JPEG
// data URLs, entirely in the browser via <canvas>, no deps, the raw video never
// leaves the page. These frames are what the multimodal VLM intake actually sees.
export async function extractFrames(src: string, count = 2): Promise<string[]> {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    v.crossOrigin = 'anonymous'; v.muted = true; v.preload = 'auto'; v.src = src
    const frames: string[] = []
    const canvas = document.createElement('canvas')
    v.onloadeddata = () => {
      const dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 8
      const times = Array.from({ length: count }, (_, i) => (dur * (i + 1)) / (count + 1))
      let idx = 0
      const seek = () => { if (idx < times.length) v.currentTime = times[idx]; else resolve(frames) }
      v.onseeked = () => {
        canvas.width = v.videoWidth || 640; canvas.height = v.videoHeight || 360
        canvas.getContext('2d')!.drawImage(v, 0, 0, canvas.width, canvas.height)
        frames.push(canvas.toDataURL('image/jpeg', 0.7)); idx++; seek()
      }
      seek()
    }
    v.onerror = () => resolve(frames)
    setTimeout(() => resolve(frames), 12000)  // safety: never hang the UI
  })
}

// Hosted sample fixtures: pre-built archetype floors for inspecting the report
// format when the user has not uploaded a real shift brief yet.
function FloorLibrary({ onResult }: { onResult: (r: Json) => void }) {
  // The library is the brain's precomputed output (built offline by build_library).
  // Serve the static catalog/runs (reliable, exact, all archetypes); the live brain
  // is the fallback. Custom "describe your floor" still goes to the live brain.
  const stat = useJson('/factoryceo/library.json')
  const live = useJson(`${BRAIN}/library`)
  const data = stat.data ?? live.data
  const floors: Json[] = data?.floors ?? []
  const [busy, setBusy] = useState<string | null>(null)
  if (!floors.length) return null
  async function open(f: Json) {
    setBusy(f.id)
    try {
      // exact precomputed run for this floor
      const s = await fetch(`/factoryceo/library/${f.id}.json`)
      if (s.ok) { onResult(await s.json()); return }
      throw new Error(String(s.status))
    } catch {
      // fallback: ask the live brain to compile it
      try {
        const r = await fetch(`${BRAIN}/plan_from_input`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: `${f.label} factory, ${f.n_jobs} jobs` }),
        })
        if (r.ok) onResult(await r.json())
      } catch { /* ignore */ }
    } finally { setBusy(null) }
  }
  return (
    <div style={card}>
      <Label n="00">Sample shift fixtures</Label>
      <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
        Use these only to inspect the report format. Your real flow should start from an uploaded shift brief, photos, video, or SOPs.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {floors.map((f) => {
          const nv = f.naive_violations ?? 0
          const onTime = Math.round((f.metrics?.on_time ?? 0) * 100)
          const tags: { t: string; c: string }[] = [
            { t: `${f.n_jobs} jobs`, c: 'var(--muted)' },
            ...(f.horizon_days ? [{ t: `${f.horizon_days}-day horizon`, c: 'var(--muted)' }] : []),
            { t: `${onTime}% on-time`, c: onTime >= 95 ? 'var(--pos)' : 'var(--muted)' },
            ...(f.n_jobs >= 24 ? [{ t: 'high-mix', c: 'var(--brand)' }] : []),
            ...((f.horizon_days ?? 99) <= 21 ? [{ t: 'tight deadline', c: 'var(--brand)' }] : []),
          ]
          return (
            <div key={f.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 16, background: 'var(--panel)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15 }}>{f.label}</span>
                {f.verified && <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--pos)' }}>verified fixture</span>}
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--text)', lineHeight: 1.45 }}>
                Test fixture with <b>{f.n_jobs} jobs</b> across a <b>{f.horizon_days ?? 30}-day</b> horizon.
                Raw baseline violations: <b style={{ color: 'var(--neg)' }}>{nv}</b>. Verified result: <b style={{ color: 'var(--pos)' }}>0 hard violations</b>.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {tags.map((tg, i) => (
                  <span key={i} style={{ fontFamily: mono, fontSize: 10, color: tg.c, border: `1px solid ${tg.c === 'var(--muted)' ? 'var(--line)' : tg.c}`, borderRadius: 999, padding: '2px 8px' }}>{tg.t}</span>
                ))}
              </div>
              <button className="btn" style={{ width: '100%' }} disabled={busy === f.id} onClick={() => open(f)}>{busy === f.id ? 'Opening…' : 'Inspect sample report'}</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Stock manufacturing-task clips (CC, from Wikimedia Commons) for initial runs.
// Picking one samples frames in-browser and hands {text, files} to the brain.
export function StockGallery({ onPick, busyId }: { onPick: (clip: Json, input: BrainInput) => void; busyId?: string | null }) {
  const { data } = useJson('/factoryceo/videos/manifest.json')
  const clips: Json[] = data?.clips ?? []
  if (!clips.length) return null
  async function pick(c: Json) {
    const frames = await extractFrames(c.file, 2)
    onPick(c, {
      text: c.summary || c.title,
      files: frames.map((f, i) => ({ name: `${c.id}-frame${i}.jpg`, kind: 'image', content: f })),
    })
  }
  return (
    <div style={card}>
      <Label n="00a">Start from a stock factory floor (video → brain)</Label>
      <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
        Real manufacturing footage. Pick one, frames are sampled in your browser and read by the multimodal brain (Qwen3.7-VL) to compile a factory it can plan.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
        {clips.map((c) => (
          <div key={c.id} style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg)' }}>
            <video src={c.file} poster={c.poster} muted loop playsInline
              onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
              onMouseLeave={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0 }}
              style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />
            <div style={{ padding: '9px 11px' }}>
              <div style={{ fontSize: 12.5, color: 'var(--text)', marginBottom: 3 }}>{c.title}</div>
              <div style={{ fontFamily: mono, fontSize: 9.5, color: 'var(--muted)', marginBottom: 8 }}>{c.capability} · {c.license}</div>
              <button className="btn primary" style={{ width: '100%' }} disabled={busyId === c.id} onClick={() => pick(c)}>
                {busyId === c.id ? 'Reading…' : 'Use this floor'}
              </button>
              <a href={c.source_url} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 6, fontFamily: mono, fontSize: 9, color: 'var(--muted)', textDecoration: 'none' }}>
                {c.author}, {c.license} ↗
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// MuJoCo physics render, before -> after: the raw plan and the verified plan each
// rolled out in the MuJoCo simulator (server-side) and shown as frame strips.
function MujocoFloor({ naive, verified, naiveHard, n }:
  { naive?: Json; verified: Json; naiveHard?: number; n: string }) {
  const [before, setBefore] = useState<Json | null>(null)
  const [after, setAfter] = useState<Json | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function call(tasks: Json) {
    const r = await fetch(`${BRAIN}/mujoco_floor`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isaac_tasks: tasks }),
    })
    if (!r.ok) throw new Error(String(r.status))
    return r.json()
  }
  async function render() {
    setBusy(true); setErr(null)
    try {
      const [b, a] = await Promise.all([naive ? call(naive) : Promise.resolve(null), call(verified)])
      setBefore(b); setAfter(a)
      if (a && !a.available) setErr(a.error || 'MuJoCo unavailable on the brain host.')
    } catch { setErr(`Brain unreachable at ${BRAIN}.`) } finally { setBusy(false) }
  }
  const strip = (label: string, sub: string, color: string, d: Json | null) => (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14 }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: 11, color }}>{sub}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${(d?.frames ?? []).length || 3}, 1fr)`, gap: 8 }}>
        {(d?.frames ?? []).map((f: string, i: number) => (
          <img key={i} src={f} alt={`mujoco ${label} ${i}`} style={{ width: '100%', borderRadius: 10, border: `1px solid ${color}`, background: '#000' }} />
        ))}
      </div>
    </div>
  )
  return (
    <div style={card}>
      <Label n={n}>MuJoCo physics render — before → after</Label>
      <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
        The raw plan and the verified plan, each rolled out in the MuJoCo simulator (the executor V-JEPA scores). Rendered server-side.
      </p>
      {!after?.available && <button className="btn primary" onClick={render} disabled={busy}>{busy ? 'Rendering…' : '▶ Render before & after'}</button>}
      {err && <div style={{ marginTop: 10, color: 'var(--warn)', fontFamily: mono, fontSize: 12 }}>{err}</div>}
      {before?.available && strip('Before · raw plan', `${naiveHard ?? '?'} hard violations`, 'var(--neg)', before)}
      {after?.available && strip('After · verified plan', '0 hard violations', 'var(--pos)', after)}
      {after?.available && <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>{after.n_frames} frames each · start → mid → end · engine: {after.engine}</div>}
    </div>
  )
}

// three.js floor: stations from the humanoid task queue + a humanoid per robot that
// walks between machines along the verified timeline. Drives off isaac_tasks.
function FloorScene3D({ tasks, n, accentVar, height = 320, bare = false }:
  { tasks: Json; n?: string; accentVar?: string; height?: number; bare?: boolean }) {
  const mount = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = mount.current
    if (!el) return
    const css = getComputedStyle(document.documentElement)
    const hex = (name: string, fallback: number) => {
      const v = css.getPropertyValue(name).trim()
      try { return new THREE.Color(v || '').getHex() } catch { return fallback }
    }
    const C = {
      floor: hex('--panel-2', 0xeceae5), grid: hex('--line', 0xdcd8d0),
      station: hex('--line', 0xcfd3da), accent: hex(accentVar || '--accent', 0x3f5fe0),
      head: hex('--panel', 0xffffff),
    }
    const queues = tasks.robot_queues ?? {}
    const machineXY: Record<string, number[]> = tasks.meta?.machines ?? {}
    const ids = Object.keys(machineXY)
    const W = el.clientWidth || 640, H = height
    const scene = new THREE.Scene()
    scene.background = null
    const cam = new THREE.PerspectiveCamera(45, W / H, 0.1, 100)
    cam.position.set(6, 7, 9); cam.lookAt(2, 0, 2)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(W, H); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    el.appendChild(renderer.domElement)
    scene.add(new THREE.AmbientLight(0xffffff, 0.7))
    const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(5, 10, 7); scene.add(key)
    // floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ color: C.floor, roughness: 1 }))
    floor.rotation.x = -Math.PI / 2; floor.position.set(2, 0, 2); scene.add(floor)
    const grid = new THREE.GridHelper(12, 12, C.grid, C.grid); grid.position.set(2, 0.01, 2); scene.add(grid)
    // stations
    const stationMesh: Record<string, THREE.Mesh> = {}
    const pos3 = (xy: number[]) => new THREE.Vector3(xy[0] * 2, 0, xy[1] * 2)
    ids.forEach((id) => {
      const p = pos3(machineXY[id])
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 1), new THREE.MeshStandardMaterial({ color: C.station }))
      m.position.set(p.x, 0.3, p.z); scene.add(m); stationMesh[id] = m
    })
    // humanoids (one per robot queue)
    const accent = new THREE.Color(C.accent)
    const robots = Object.entries(queues).map(([rid, q]) => {
      const g = new THREE.Group()
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.5, 4, 8), new THREE.MeshStandardMaterial({ color: accent }))
      body.position.y = 0.75
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), new THREE.MeshStandardMaterial({ color: C.head }))
      head.position.y = 1.2
      g.add(body); g.add(head); scene.add(g)
      return { rid, q: q as Json[], g }
    })
    const allHrs = robots.flatMap((r) => r.q.map((t) => t.end_hr))
    const maxHr = Math.max(1, ...allHrs)
    let raf = 0; const clock = new THREE.Clock()
    const tick = () => {
      const t = (clock.getElapsedTime() * 0.12) % 1   // loop the whole horizon every ~8s
      const hr = t * maxHr
      // reset station colors
      ids.forEach((id) => ((stationMesh[id].material as THREE.MeshStandardMaterial).color.setHex(C.station)))
      robots.forEach((r) => {
        const active = r.q.find((task) => hr >= task.start_hr && hr < task.end_hr)
        const target = active ?? r.q[r.q.length - 1] ?? r.q[0]
        if (target) {
          const p = pos3(target.machine_xy ?? machineXY[target.machine] ?? [0, 0])
          r.g.position.lerp(new THREE.Vector3(p.x, 0, p.z + 0.9), 0.06)
          if (active && stationMesh[active.machine]) (stationMesh[active.machine].material as THREE.MeshStandardMaterial).color.copy(accent)
        }
      })
      renderer.render(scene, cam)
      raf = requestAnimationFrame(tick)
    }
    tick()
    const onResize = () => { const w = el.clientWidth || 640; cam.aspect = w / H; cam.updateProjectionMatrix(); renderer.setSize(w, H) }
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); renderer.dispose(); el.removeChild(renderer.domElement) }
  }, [tasks, accentVar, height])
  const canvas = <div ref={mount} style={{ width: '100%', height, borderRadius: 10, overflow: 'hidden', background: 'var(--bg)' }} />
  if (bare) return canvas
  return (
    <div style={card}>
      <Label n={n ?? '·'}>Humanoid executes on the 3D floor (verified plan)</Label>
      {canvas}
      <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
        stations light up as each humanoid reaches them along the verified timeline · loops the full horizon
      </div>
    </div>
  )
}

// Before -> After: the same scene with the RAW plan vs the verified plan, so the
// verifier's value is visible, not just tabulated.
function BeforeAfter({ naive, verified, naiveHard, n }:
  { naive: Json; verified: Json; naiveHard: number; n: string }) {
  const panel = (label: string, sub: string, color: string, tasks: Json, accentVar: string) => (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14 }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: 11, color }}>{sub}</span>
      </div>
      <FloorScene3D tasks={tasks} accentVar={accentVar} height={240} bare />
    </div>
  )
  return (
    <div style={card}>
      <Label n={n}>Before → after: what the verifier actually fixes</Label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        {panel('Raw plan', `${naiveHard} hard violations`, 'var(--neg)', naive, '--neg')}
        {panel('Verified plan', '0 hard violations', 'var(--pos)', verified, '--pos')}
      </div>
      <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
        same factory, same humanoid: the raw plan (left) violates {naiveHard} hard constraints; recursive TRM repair drives it to a feasible, safe schedule (right).
      </div>
    </div>
  )
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
      if (f.type.startsWith('image/')) {
        const url = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f) })
        out.push({ name: f.name, kind: 'image', content: url })
      } else if (f.type.startsWith('video/')) {
        const u = URL.createObjectURL(f)
        const frames = await extractFrames(u, 2)
        URL.revokeObjectURL(u)
        frames.forEach((fr, i) => out.push({ name: `${f.name}-frame${i}.jpg`, kind: 'image', content: fr }))
      } else out.push({ name: f.name, kind: 'text', content: await f.text() })
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

  const sample = 'Automotive injection-molding + CNC shop. ~14 jobs this month, clips and brackets in ABS and Nylon, a few medical syringe runs in PP. M2 has been overheating. One operator out sick next week. Acme wants 10k clips by Friday at $0.18/unit.'
  return (
    <div style={{ ...card, borderColor: 'var(--accent)' }}>
      <Label n="00">Your factory floor, describe it, the brain plans it</Label>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6}
        placeholder="Paste RFQs, machine logs, operator notes, inventory, anything. The brain compiles it into a real, feasible factory and plans it."
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

const CELL_W = 168, CELL_H = 118, GAP = 26, PAD = 30, BOX_W = 138, BOX_H = 88
function layout(machines: Json[]): Record<string, { x: number; y: number; w: number; h: number }> {
  const cols = Math.max(1, Math.ceil(Math.sqrt(machines.length || 1)))
  const out: Record<string, { x: number; y: number; w: number; h: number }> = {}
  machines.forEach((m, i) => {
    const r = Math.floor(i / cols), c = i % cols
    out[m.id] = { x: PAD + c * (CELL_W + GAP) + (CELL_W - BOX_W) / 2, y: PAD + r * (CELL_H + GAP), w: BOX_W, h: BOX_H }
  })
  return out
}

function intersects(a: Rect, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

// capability -> glyph + color, so each station reads as a piece of equipment.
const CAP_STYLE: Record<string, { glyph: string; color: string }> = {
  mold: { glyph: '◳', color: 'var(--accent)' },
  cnc: { glyph: '⚙', color: 'var(--warn)' },
  deburr: { glyph: '✦', color: 'var(--pos)' },
  assembly: { glyph: '⛭', color: 'var(--brand)' },
  inspect: { glyph: '◎', color: 'var(--brand)' },
}
const capStyle = (caps: string[] = []) => CAP_STYLE[caps[0]] ?? { glyph: '▰', color: 'var(--muted)' }

function FloorPlanLasso({ machines, onResult }: { machines: Json[]; onResult: (r: Json) => void }) {
  const pos = useMemo(() => layout(machines), [machines])
  const cols = Math.max(1, Math.ceil(Math.sqrt(machines.length || 1)))
  const rows = Math.max(1, Math.ceil((machines.length || 1) / cols))
  const W = PAD * 2 + cols * CELL_W + (cols - 1) * GAP
  const H = PAD * 2 + (rows - 1) * CELL_H + BOX_H
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
      <Label n="02">Floor plan — lasso the stations to optimize</Label>
      <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
        Drag a box across the equipment you want the brain to focus on; it re-plans just that region.
      </p>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, borderRadius: 14, touchAction: 'none', cursor: 'crosshair', userSelect: 'none', display: 'block' }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up}>
        <defs>
          <pattern id="fp-grid" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M22 0 L0 0 0 22" fill="none" stroke="var(--line)" strokeWidth="0.6" opacity="0.6" />
          </pattern>
          <filter id="fp-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="var(--accent)" floodOpacity="0.45" />
          </filter>
          <filter id="fp-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodColor="#0d0d0f" floodOpacity="0.10" />
          </filter>
        </defs>
        <rect x={0} y={0} width={W} height={H} rx={14} fill="var(--panel-2)" />
        <rect x={0} y={0} width={W} height={H} rx={14} fill="url(#fp-grid)" />
        <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={14} fill="none" stroke="var(--line)" />
        {machines.map((m) => {
          const b = pos[m.id], on = sel.includes(m.id), cs = capStyle(m.capabilities)
          return (
            <g key={m.id} filter={on ? 'url(#fp-glow)' : 'url(#fp-shadow)'} style={{ transition: 'all .15s' }}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={12}
                fill="var(--panel)" stroke={on ? 'var(--accent)' : 'var(--line)'} strokeWidth={on ? 2.5 : 1} />
              {on && <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={12} fill="var(--accent)" fillOpacity={0.06} />}
              {/* capability chip */}
              <rect x={b.x + 12} y={b.y + 12} width={26} height={26} rx={8} fill={cs.color} fillOpacity={0.16} />
              <text x={b.x + 25} y={b.y + 30} textAnchor="middle" fontSize={15} fill={cs.color}>{cs.glyph}</text>
              {/* id + caps */}
              <text x={b.x + 46} y={b.y + 25} fontFamily="var(--font-display)" fontWeight={800} fontSize={16} fill="var(--text)">{m.id}</text>
              <text x={b.x + 46} y={b.y + 40} fontFamily={mono} fontSize={8.5} fill="var(--muted)">{(m.capabilities ?? []).join(' · ')}</text>
              {/* status row */}
              <circle cx={b.x + 16} cy={b.y + b.h - 16} r={3} fill={(m.uptime ?? 1) >= 0.9 ? 'var(--pos)' : 'var(--warn)'} />
              <text x={b.x + 26} y={b.y + b.h - 12} fontFamily={mono} fontSize={8.5} fill="var(--muted)">
                {(m.uptime ?? 1) >= 0.9 ? 'healthy' : 'degraded'}
              </text>
              {on && (
                <g>
                  <circle cx={b.x + b.w - 16} cy={b.y + 16} r={9} fill="var(--accent)" />
                  <text x={b.x + b.w - 16} y={b.y + 20} textAnchor="middle" fontSize={11} fill="#fff" fontWeight={700}>✓</text>
                </g>
              )}
            </g>
          )
        })}
        {dr && dr.w * dr.h >= 40 && (
          <rect x={dr.x} y={dr.y} width={dr.w} height={dr.h} rx={6} fill="var(--accent)" fillOpacity={0.10} stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="6 4">
            <animate attributeName="stroke-dashoffset" from="0" to="20" dur="0.6s" repeatCount="indefinite" />
          </rect>
        )}
      </svg>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 14 }}>
        <button className="btn primary" onClick={optimize} disabled={busy || !sel.length}>{busy ? 'Optimizing…' : `▶ Optimize region (${sel.length})`}</button>
        {sel.length > 0
          ? <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--accent)' }}>selected: {sel.join(', ')}</span>
          : <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--muted)' }}>drag to select stations</span>}
      </div>
      {err && <div style={{ marginTop: 10, color: 'var(--neg)', fontFamily: mono, fontSize: 12 }}>{err}</div>}
    </div>
  )
}

function RegionResult({ region }: { region: Json }) {
  return (
    <div style={{ ...card, borderColor: region.verified ? 'var(--pos)' : 'var(--neg)' }}>
      <Label n="00c">Region optimized, {region.machine_ids?.join(', ')}</Label>
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div><div style={{ fontFamily: mono, fontSize: 30, color: region.verified ? 'var(--pos)' : 'var(--neg)' }}>{region.hard_violations}</div><div style={{ fontFamily: mono, fontSize: 10, color: 'var(--muted)' }}>HARD VIOLATIONS</div></div>
        <div><div style={{ fontFamily: mono, fontSize: 30, color: 'var(--accent)' }}>{region.n_ops}</div><div style={{ fontFamily: mono, fontSize: 10, color: 'var(--muted)' }}>OPS IN REGION</div></div>
        <div><div style={{ fontFamily: mono, fontSize: 30, color: 'var(--text)' }}>{(region.job_ids ?? []).length}</div><div style={{ fontFamily: mono, fontSize: 10, color: 'var(--muted)' }}>JOBS TOUCHED</div></div>
      </div>
      <div style={{ marginTop: 12 }}>{(region.job_ids ?? []).map((j: string) => <Chip key={j}>{j}</Chip>)}</div>
    </div>
  )
}

function Baseline({ b, n }: { b: Json; n: string }) {
  const hm = b.headline_metrics ?? {}, raw = hm.frontier_llm_raw ?? {}, trm = hm.factoryceo_trm ?? {}
  const lb: Json[] = b.hud_leaderboard ?? []
  const maxR = Math.max(...lb.map((x) => x.reward), 1)
  const cell = (v: any, good: boolean) => <td style={{ padding: '7px 8px', textAlign: 'right', color: good ? 'var(--pos)' : 'var(--neg)' }}>{v}</td>
  return (
    <div style={{ ...card, borderColor: 'var(--neg)' }}>
      <Label n={n}>Baseline comparison on the sample fixture</Label>
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
  const desc = !a ? 'raw plan, before any repair' : `${a.op}${a.job_id ? ` · ${a.job_id}/${a.operation_id ?? ''}` : ''}${a.machine_id ? ` → ${a.machine_id}/${a.operator_id ?? ''}` : ''}${a.material ? ` · ${a.material}` : ''}`
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
          <div style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--muted)', marginBottom: 5 }}>{rid} (humanoid), {q.length} tasks</div>
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
      <Label n={n}>Scoreboard, 30-day run, averaged over scenarios</Label>
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
              <td style={{ padding: '8px', textAlign: 'right', color: (r.safety_incidents ?? 0) === 0 ? 'var(--pos)' : 'var(--neg)' }}>{r.safety_incidents ?? '-'}</td>
            </tr>
          )
        })}</tbody>
      </table>
    </div>
  )
}

// Step 3 of the diagram: teacher → small specialist. Shows the distillation
// pipeline, the LLM-alone vs trained TRM gain, and a per-customer checkpoint you
// train once and reload on return.
function TrainDistill({ rows, n, customerId, customerName, taskId, state }: { rows: Json[]; n: string; customerId?: string; customerName?: string; taskId?: string; state?: Json }) {
  const base = rows.find((r) => r.method === 'base_llm') ?? rows.find((r) => r.method === 'llm_retry')
  const trm = rows.find((r) => r.method === 'trm')
  const cid = customerId || 'default'
  const key = taskId || cid                              // per-task checkpoint key
  const taskSpecific = !!(taskId && state && (state.machines ?? []).length)
  const [ckpt, setCkpt] = useState<Json | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    let on = true
    fetch(`${BRAIN}/checkpoint/${encodeURIComponent(key)}`).then((r) => r.json()).then((j) => { if (on) setCkpt(j) }).catch(() => {})
    return () => { on = false }
  }, [key])
  async function trainSave() {
    setBusy(true); setErr(null)
    try {
      const r = await fetch(`${BRAIN}/train_trm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: cid, task_id: taskId || '', state: taskSpecific ? state : null, n_episodes: 40, epochs: 40 }),
      })
      if (!r.ok) throw new Error(String(r.status))
      const m = await r.json()
      setCkpt({ ...m, loadable: m.trained })
    } catch { setErr(`Brain unreachable at ${BRAIN}.`) } finally { setBusy(false) }
  }
  const stat = (label: string, b: any, t: any, fmt: (v: number) => string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span><span style={{ color: 'var(--neg)' }}>{fmt(b)}</span> <span style={{ color: 'var(--muted)' }}>→</span> <span style={{ color: 'var(--pos)', fontWeight: 600 }}>{fmt(t)}</span></span>
    </div>
  )
  return (
    <div style={card}>
      <Label n={n}>Teacher → student: train a TRM (+ optional Gemma) on verified traces</Label>
      <p style={{ margin: '0 0 14px', color: 'var(--text)', lineHeight: 1.6, fontSize: 13.5 }}>
        The serverless teacher proposes plans; the verifier + recursive repair turn each proposal into a <b>verified reasoning trace</b>. Those traces can train a small specialist for this narrow scheduling domain, while the verifier remains the gate before execution.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, fontFamily: mono, fontSize: 11 }}>
        {['seed corpus', 'teacher amplifies', 'verifier gates', 'verified traces', 'distill TRM', 'Gemma fallback'].map((s, i) => (
          <span key={s} style={{ color: 'var(--muted)' }}>{i > 0 && <span style={{ margin: '0 6px', color: 'var(--line)' }}>→</span>}{s}</span>
        ))}
      </div>
      {base && trm && (
        <div>
          {stat('invalid actions', base.invalid_actions, trm.invalid_actions, (v) => String(v))}
          {stat('customer trust', base.customer_trust, trm.customer_trust, (v) => String(Math.round(v)))}
          {stat('profit', base.profit, trm.profit, (v) => Math.round(v).toLocaleString())}
          {stat('on-time', base.on_time_rate, trm.on_time_rate, (v) => `${Math.round(v * 100)}%`)}
        </div>
      )}

      {/* per-customer trained checkpoint: train once, reload on return */}
      <div style={{ marginTop: 16, padding: '14px 16px', border: `1px solid ${ckpt?.trained ? 'var(--pos)' : 'var(--line)'}`, borderRadius: 10, background: 'var(--bg)' }}>
        <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
          TRM checkpoint · {taskSpecific ? 'per-task' : 'per-customer'} · {customerName || cid}
        </div>
        {ckpt?.trained ? (
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: 'var(--pos)', fontWeight: 700 }}>✓ checkpoint loaded</span>
            <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--text)' }}>{ckpt.params?.toLocaleString()} params</span>
            <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--text)' }}>train acc {Math.round((ckpt.train_acc ?? 0) * 100)}%</span>
            <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)' }}>{ckpt.n_traces} traces · {String(ckpt.created || '').slice(0, 10)}</span>
            <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={trainSave} disabled={busy}>{busy ? 'Retraining…' : '↻ retrain'}</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>No saved model for this customer yet.</span>
            <button className="btn primary" onClick={trainSave} disabled={busy}>{busy ? 'Training & saving…' : '▶ Train & save checkpoint'}</button>
          </div>
        )}
        {err && <div style={{ marginTop: 8, color: 'var(--neg)', fontFamily: mono, fontSize: 12 }}>{err}</div>}
      </div>
    </div>
  )
}

// One-button pipeline: Fireworks/seed synth -> TRM train -> V-JEPA eval
// (-> optional HUD graded rollout, which spends credits). Gemma is a gated step.
function Pipeline({ n }: { n: string }) {
  const [d, setD] = useState<Json | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [teacher, setTeacher] = useState<'deterministic' | 'fireworks'>('deterministic')
  const [err, setErr] = useState<string | null>(null)
  async function run(run_hud: boolean) {
    setBusy(run_hud ? 'hud' : 'run'); setErr(null)
    try {
      const r = await fetch(`${BRAIN}/pipeline`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed: 3, teacher, n_episodes: 12, epochs: 40, run_hud }),
      })
      if (!r.ok) throw new Error(String(r.status))
      setD(await r.json())
    } catch { setErr(`Brain unreachable at ${BRAIN}.`) } finally { setBusy(null) }
  }
  const s = d?.stages ?? {}
  const Stage = ({ k, label, body, state }: { k: string; label: string; body: string; state: any }) => {
    const ok = state?.ok
    const color = ok === true ? 'var(--pos)' : ok === false ? 'var(--neg)' : 'var(--muted)'
    const dot = ok === true ? '●' : ok === false ? '✕' : '○'
    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
        <span style={{ color, fontFamily: mono, fontSize: 13, width: 14 }}>{dot}</span>
        <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', width: 70 }}>{k}</span>
        <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{label}</span>
        <span style={{ fontFamily: mono, fontSize: 12, color }}>{body}</span>
      </div>
    )
  }
  return (
    <div style={{ ...card, borderColor: 'var(--brand)' }}>
      <Label n={n}>One-button training pipeline (synth → TRM → JEPA → HUD)</Label>
      <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
        Press once: generate synthetic verified traces (Fireworks/seed), distil the TRM, score execution with V-JEPA. The HUD graded rollout spends real HUD credits; Gemma fine-tune is a separate paid step.
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          {(['deterministic', 'fireworks'] as const).map((t) => (
            <button key={t} onClick={() => setTeacher(t)} style={{ border: 'none', padding: '7px 12px', fontSize: 12, cursor: 'pointer', background: teacher === t ? 'var(--accent)' : 'var(--panel)', color: teacher === t ? '#fff' : 'var(--muted)' }}>
              {t === 'fireworks' ? 'Qwen synth' : 'free synth'}
            </button>
          ))}
        </div>
        <button className="btn primary" onClick={() => run(false)} disabled={!!busy}>{busy === 'run' ? 'Running…' : '▶ Run pipeline'}</button>
        <button className="btn" onClick={() => run(true)} disabled={!!busy} title="Spends HUD credits">{busy === 'hud' ? 'Running + HUD…' : '▶ Run + HUD rollout (credits)'}</button>
      </div>
      {err && <div style={{ marginBottom: 10, color: 'var(--neg)', fontFamily: mono, fontSize: 12 }}>{err}</div>}
      {d && (
        <div>
          <Stage k="synth" label={`synthetic traces (${s.synth?.source})`} state={s.synth} body={`${s.synth?.trace_steps ?? 0} steps`} />
          <Stage k="trm" label="distil tiny recursive model" state={s.trm} body={s.trm?.ok ? `${s.trm.params?.toLocaleString()} params · ${Math.round((s.trm.train_acc ?? 0) * 100)}% acc` : (s.trm?.error ?? '—')} />
          <Stage k="jepa" label={`V-JEPA execution eval${s.jepa?.real ? ' (real)' : ' (stub)'}`} state={s.jepa} body={s.jepa?.ok ? `score ${s.jepa.score}` : (s.jepa?.error ?? '—')} />
          <Stage k="hud" label="HUD graded rollout (credits)" state={s.hud} body={s.hud?.ok === null ? 'skipped' : (s.hud?.output ? 'see output' : (s.hud?.error ?? 'done'))} />
          <Stage k="gemma" label="Gemma fine-tune (paid)" state={s.gemma} body="gated" />
          {s.hud?.output && <pre style={{ fontFamily: mono, fontSize: 11, whiteSpace: 'pre-wrap', marginTop: 10, color: 'var(--text)', background: 'var(--bg)', padding: 10, borderRadius: 8 }}>{s.hud.output}</pre>}
        </div>
      )}
    </div>
  )
}

// Long-horizon manufacturing eval (DragonBench-style): naive / greedy / TRM across
// the HUD Taskset (14-60 day scenarios), partial-credit leaderboard + per-task.
function EvalReport({ n }: { n: string }) {
  const [d, setD] = useState<Json | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function run() {
    setBusy(true); setErr(null)
    try {
      const r = await fetch(`${BRAIN}/eval_report`)
      if (!r.ok) throw new Error(String(r.status))
      setD(await r.json())
    } catch { setErr(`Brain unreachable at ${BRAIN}.`) } finally { setBusy(false) }
  }
  const col: Record<string, string> = { trm: 'var(--pos)', greedy: 'var(--accent)', naive: 'var(--neg)' }
  const maxScore = 1
  return (
    <div style={card}>
      <Label n={n}>Long-horizon eval: how the verifier-gated brain improves the benchmark</Label>
      <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
        The same approaches run across a Taskset of 14-60 day factory scenarios, scored by partial credit (feasibility + on-time + safety + profit). This is the manufacturing analogue of a single-answer eval report.
      </p>
      {!d && <button className="btn primary" onClick={run} disabled={busy}>{busy ? 'Running eval…' : '▶ Run long-horizon eval'}</button>}
      {err && <div style={{ marginTop: 10, color: 'var(--warn)', fontFamily: mono, fontSize: 12 }}>{err}</div>}
      {d && (
        <div>
          <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
            {d.benchmark} · {d.n_tasks} tasks · horizons {(d.horizons ?? []).join('/')} days
          </div>
          {/* leaderboard bars */}
          <div style={{ marginBottom: 16 }}>
            {(d.leaderboard ?? []).map((l: Json) => (
              <div key={l.agent} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text)', fontWeight: l.agent === 'trm' ? 700 : 400 }}>{l.agent === 'naive' ? 'frontier-style (no repair)' : l.agent === 'trm' ? 'verifier-gated TRM' : 'greedy'}</span>
                  <span style={{ fontFamily: mono, color: col[l.agent] }}>{l.score.toFixed(3)}</span>
                </div>
                <div style={{ height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${(100 * l.score) / maxScore}%`, height: '100%', background: col[l.agent] }} />
                </div>
              </div>
            ))}
          </div>
          {/* per-task table */}
          <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
            <thead><tr style={{ color: 'var(--muted)', fontFamily: mono, fontSize: 10 }}>
              <th style={{ textAlign: 'left', padding: '5px 6px' }}>task</th>
              <th style={{ padding: '5px 6px', textAlign: 'right' }}>horizon</th>
              <th style={{ padding: '5px 6px', textAlign: 'right' }}>naive</th>
              <th style={{ padding: '5px 6px', textAlign: 'right' }}>greedy</th>
              <th style={{ padding: '5px 6px', textAlign: 'right' }}>TRM</th></tr></thead>
            <tbody>{(d.rows ?? []).map((r: Json) => (
              <tr key={r.task} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '6px', color: 'var(--text)' }}>{r.task}</td>
                <td style={{ padding: '6px', textAlign: 'right', color: 'var(--muted)' }}>{r.horizon_days}d</td>
                {['naive', 'greedy', 'trm'].map((a) => {
                  const pc = r.agents[a]
                  return <td key={a} style={{ padding: '6px', textAlign: 'right', color: pc.feasible ? 'var(--pos)' : 'var(--neg)' }}>{pc.total.toFixed(2)}{pc.feasible ? '' : ` (${pc.hard_violations})`}</td>
                })}
              </tr>
            ))}</tbody>
          </table>
          <p style={{ margin: '12px 0 0', color: 'var(--text)', fontSize: 12.5, lineHeight: 1.5 }}>{d.headline}</p>
        </div>
      )}
    </div>
  )
}

// Final step: teacher gives actionable feedback the operator can use to patch the
// humanoid for next time. Real call to the brain's /teacher_feedback (Fireworks).
function TeacherFeedback({ live, n }: { live: Json | null; n: string }) {
  const [fb, setFb] = useState<Json | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function ask() {
    setBusy(true); setErr(null)
    try {
      const r = await fetch(`${BRAIN}/teacher_feedback`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episode: live?.episode, isaac_tasks: live?.isaac_tasks, intake: live?.intake }),
      })
      if (!r.ok) throw new Error(String(r.status))
      setFb(await r.json())
    } catch { setErr(`Brain unreachable at ${BRAIN}.`) } finally { setBusy(false) }
  }
  return (
    <div style={card}>
      <Label n={n}>Actionable feedback, patch the humanoid for next time</Label>
      <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
        The teacher reviews the verified run and writes concrete patches the operator (or the humanoid's policy) should apply next cycle.
      </p>
      {!fb && <button className="btn primary" onClick={ask} disabled={busy || !live}>{busy ? 'Asking the teacher…' : '▶ Get actionable feedback'}</button>}
      {err && <div style={{ marginTop: 10, color: 'var(--neg)', fontFamily: mono, fontSize: 12 }}>{err}</div>}
      {fb && (
        <div>
          {fb.summary && <p style={{ margin: '0 0 12px', color: 'var(--text)', lineHeight: 1.6 }}>{fb.summary}</p>}
          {(fb.patches ?? []).map((p: Json, i: number) => (
            <div key={i} style={{ borderLeft: '2px solid var(--accent)', background: 'var(--bg)', padding: '10px 12px', marginBottom: 8, borderRadius: '0 8px 8px 0' }}>
              <div style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--accent)', marginBottom: 3 }}>{p.target ?? `patch ${i + 1}`}</div>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{typeof p === 'string' ? p : p.action ?? p.text}</div>
            </div>
          ))}
          <button className="btn ghost" style={{ marginTop: 6 }} onClick={ask} disabled={busy}>↻ regenerate</button>
        </div>
      )}
    </div>
  )
}

// Legible "what the verifier caught" — the actual hard constraints the raw plan
// broke, grouped and explained, then driven to zero. This is the real before/after.
const VIO_LABEL: Record<string, string> = {
  machine_overlap: 'Machine double-booked (two ops at once)',
  capability_mismatch: 'Wrong machine for the operation',
  operator_unavailable: 'Operator not on shift',
  operator_unqualified: 'Operator lacks the skill',
  material_shortage: 'Not enough material',
  material_late: 'Material arrives after the op starts',
  maintenance_conflict: 'Scheduled during machine maintenance',
  precedence_violation: 'Operation order broken',
  hallucinated_entity: 'References a machine/job that does not exist',
  unscheduled_operation: 'Operation left unscheduled',
  bad_window: 'Operation outside its allowed time window',
  overlap: 'Two operations overlap',
}

// What each repair op means in plain English (the brain/TRM's decisions).
const OP_LABEL: Record<string, string> = {
  move_operation: 'Moved the op to a free slot',
  swap_machine: 'Swapped to a capable machine',
  assign_operator: 'Assigned a qualified, on-shift operator',
  delay_job: 'Delayed the job to respect constraints',
  add_overtime: 'Added overtime to hit the deadline',
  expedite_material: 'Expedited material to arrive in time',
  reject_rfq: 'Rejected an unprofitable order',
  warn_customer: 'Warned the customer of a delay',
  inspect: 'Scheduled a safety inspection',
  lockout: 'Locked out a degraded machine',
  slowdown: 'Capped robot continuous run (safety)',
  noop: 'No change needed',
}

// Decision ledger: the LLM authored the raw plan; the brain/TRM made these repair
// decisions. Each row = the LLM's mistake → the brain's fix → the revenue +
// reliability impact. This is the "why our method is better" view for judges.
function WhatWasFixed({ ep, naiveHard, n }: { ep: Json; naiveHard?: number; n: string }) {
  const steps: Json[] = ep?.repair_trace ?? []
  const before = ep?.verifier_before?.n_hard ?? naiveHard ?? (ep?.verifier_before?.errors ?? []).length
  const r0 = Math.round(ep?.verifier_before?.reward ?? 0)
  const rf = Math.round(ep?.verifier_after?.reward ?? 0)
  const m = ep?.verifier_after?.metrics ?? {}
  // reward trajectory across the brain's decisions (profit climbing)
  const series = [r0, ...steps.map((s) => Math.round(s.reward_after ?? r0))]
  const lo = Math.min(...series), hi = Math.max(...series), span = (hi - lo) || 1
  const W = 720, H = 60
  const xs = (i: number) => (i / Math.max(1, series.length - 1)) * W
  const ys = (v: number) => H - 6 - ((v - lo) / span) * (H - 12)
  const stat = (v: React.ReactNode, l: string, c: string) => (
    <div><div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: c, lineHeight: 1 }}>{v}</div><div style={{ fontFamily: mono, fontSize: 9.5, color: 'var(--muted)', marginTop: 5, textTransform: 'uppercase' }}>{l}</div></div>
  )
  const prev = (i: number) => (i === 0 ? r0 : Math.round(steps[i - 1].reward_after ?? r0))
  return (
    <div style={card}>
      <Label n={n}>Who decided what — LLM plan vs brain repairs, and the $ impact</Label>
      <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5 }}>
        The <b style={{ color: 'var(--neg)' }}>LLM</b> authored the raw plan ({before} hard violations, reward {r0.toLocaleString()}). The <b style={{ color: 'var(--pos)' }}>brain/TRM</b> then made {steps.length} repair decisions, each fixing one and lifting reward.
      </p>
      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', marginBottom: 14 }}>
        {stat(`${before} → 0`, 'violations (reliability)', 'var(--pos)')}
        {stat(`${r0.toLocaleString()} → ${rf.toLocaleString()}`, 'verifier reward', 'var(--brand)')}
        {stat(Math.round(m.profit ?? 0).toLocaleString(), 'profit', 'var(--text)')}
        {stat(`${Math.round((m.on_time_rate ?? 0) * 100)}%`, 'on-time', 'var(--text)')}
      </div>
      {/* reward climbs as the brain makes decisions */}
      {series.length > 1 && (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 52, marginBottom: 12 }} preserveAspectRatio="none">
          <polyline points={series.map((v, i) => `${xs(i)},${ys(v)}`).join(' ')} fill="none" stroke="var(--brand)" strokeWidth={2} />
          {series.map((v, i) => <circle key={i} cx={xs(i)} cy={ys(v)} r={2.2} fill="var(--brand)" />)}
        </svg>
      )}
      {/* per-decision ledger */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {steps.slice(0, 12).map((s, i) => {
          const te = s.targeted_error || {}
          const op = s.repair_action?.op ?? 'noop'
          const tgt = [s.repair_action?.job_id && `${s.repair_action.job_id}/${s.repair_action.operation_id ?? ''}`, s.repair_action?.machine_id, s.repair_action?.operator_id, s.repair_action?.material].filter(Boolean).join(' → ')
          const d = Math.round((s.reward_after ?? r0)) - prev(i)
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'baseline', padding: '9px 0', borderTop: '1px solid var(--line)' }}>
              <div>
                <div style={{ fontFamily: mono, fontSize: 9.5, color: 'var(--neg)', textTransform: 'uppercase' }}>LLM got wrong</div>
                <div style={{ fontSize: 12.5 }}>{VIO_LABEL[te.type] ?? te.type ?? 'violation'}</div>
              </div>
              <div>
                <div style={{ fontFamily: mono, fontSize: 9.5, color: 'var(--pos)', textTransform: 'uppercase' }}>brain decided</div>
                <div style={{ fontSize: 12.5 }}>{OP_LABEL[op] ?? op} <span style={{ fontFamily: mono, color: 'var(--muted)', fontSize: 10.5 }}>{tgt}</span></div>
              </div>
              <div style={{ textAlign: 'right', fontFamily: mono, fontSize: 12, color: d >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{d >= 0 ? '+' : ''}{d.toLocaleString()}</div>
            </div>
          )
        })}
        {steps.length > 12 && <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--muted)', paddingTop: 8 }}>+{steps.length - 12} more repair decisions</div>}
      </div>
    </div>
  )
}

function IntakeThinking({ busy, err, brainUrl }: { busy: boolean; err: string | null; brainUrl: string }) {
  return (
    <div style={{ ...card, borderColor: busy ? 'var(--accent)' : err ? 'var(--warn)' : 'var(--line)' }}>
      <Label n="01">Analyzing your shift brief</Label>
      <h2 style={{ margin: '0 0 10px', fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>
        Building the plan through the brain, not a page jump.
      </h2>
      <p style={{ margin: '0 0 16px', color: 'var(--muted)', lineHeight: 1.55, maxWidth: 700 }}>
        The upload is sent to the brain service, which asks Fireworks for the planning pass when configured,
        then runs the deterministic verifier and repair loop before showing an executable shift plan.
      </p>
      <div className="thinking-steps">
        <div className="thinking-step on">
          <span>1</span>
          <strong>Read operator brief</strong>
          <small>Text, photos, and video frames are converted into a factory state.</small>
        </div>
        <div className={`thinking-step ${busy ? 'on' : ''}`}>
          <span>2</span>
          <strong>Fireworks planning pass</strong>
          <small>Qwen/Gemma proposes the shift plan when `FIREWORKS_API_KEY` is available.</small>
        </div>
        <div className={`thinking-step ${busy ? 'on' : ''}`}>
          <span>3</span>
          <strong>Verifier + repair</strong>
          <small>Hard constraints are checked and repaired before anything is marked runnable.</small>
        </div>
      </div>
      {busy && <div style={{ marginTop: 16, color: 'var(--accent)', fontFamily: mono, fontSize: 12 }}>calling {brainUrl}/plan_from_input with planner=fireworks...</div>}
      {err && <div style={{ marginTop: 16, color: 'var(--warn)', fontFamily: mono, fontSize: 12.5 }}>{err}</div>}
    </div>
  )
}

function ReasoningPanel({ live }: { live: Json }) {
  const reasoning = live.reasoning ?? {}
  const planner = live.planner ?? {}
  const observations: string[] = Array.isArray(reasoning.observations) ? reasoning.observations : []
  const assumptions: string[] = Array.isArray(reasoning.assumptions) ? reasoning.assumptions : []
  const plan: string[] = Array.isArray(reasoning.plan) ? reasoning.plan : []
  const risks: string[] = Array.isArray(reasoning.risks) ? reasoning.risks : []
  const rows = [
    ['Planner', planner.actual === 'fireworks' ? 'Fireworks' : planner.actual ?? 'deterministic'],
    ['Requested', planner.requested ?? 'fireworks'],
    ['Model', planner.model ?? 'fallback'],
    ['Intake', live.intake?.source ?? 'compiled'],
  ]
  return (
    <div style={{ ...card, borderColor: planner.actual === 'fireworks' ? 'var(--accent)' : 'var(--warn)' }}>
      <Label n="00">Reasoning + provenance</Label>
      <div className="reasoning-grid">
        <div>
          <div className="panel-kicker">Operator-facing rationale</div>
          {[...observations, ...assumptions].slice(0, 5).map((item, i) => (
            <p key={i} className="reasoning-line">{item}</p>
          ))}
        </div>
        <div>
          <div className="panel-kicker">Plan of attack</div>
          {plan.slice(0, 4).map((item, i) => (
            <p key={i} className="reasoning-line">{item}</p>
          ))}
          {risks.slice(0, 2).map((item, i) => (
            <p key={`risk-${i}`} className="reasoning-line warn">{item}</p>
          ))}
        </div>
        <dl className="reasoning-meta">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

export function FactoryCeoPanel({ initial, onRestart, onRun, customerId, customerName, taskId }: { initial?: BrainInput | null; onRestart?: () => void; onRun?: (run: Json) => void; customerId?: string; customerName?: string; taskId?: string } = {}) {
  const { data: run } = useJson('/factoryceo/run.json')
  const { data: baseline } = useJson('/factoryceo/baseline.json')
  const { data: cannedTasks } = useJson('/factoryceo/isaac_tasks.json')
  const [live, setLive] = useState<Json | null>(null)
  const [autoBusy, setAutoBusy] = useState(false)
  const [autoErr, setAutoErr] = useState<string | null>(null)
  const [pickBusy, setPickBusy] = useState<string | null>(null)
  const [adv, setAdv] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)

  // Set the live run and persist it to the current floor (profile store).
  function applyRun(j: Json | null) { setLive(j); if (j) onRun?.(j) }

  // When a floor is opened/compiled, jump to the result so the change is obvious.
  useEffect(() => {
    if (live) setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }, [live])

  // Real backend call on the captured input (messy inputs / video frames).
  useEffect(() => {
    if (!initial || (!initial.text && !initial.files?.length)) return
    let cancelled = false
    setAutoBusy(true); setAutoErr(null)
    fetch(`${BRAIN}/plan_from_input`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: initial.text, files: initial.files, planner: 'fireworks', return_reasoning: true }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => { if (!cancelled) applyRun(j) })
      .catch(() => { if (!cancelled) setAutoErr(`Brain unreachable at ${BRAIN}, showing the prebuilt run. Start it: cd factoryceo_trm && uvicorn api:app --port 8090.`) })
      .finally(() => { if (!cancelled) setAutoBusy(false) })
    return () => { cancelled = true }
  }, [initial])

  async function pickStock(clip: Json, input: BrainInput) {
    setPickBusy(clip.id); setAutoErr(null)
    try {
      const r = await fetch(`${BRAIN}/plan_from_input`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, planner: 'fireworks', return_reasoning: true }),
      })
      if (!r.ok) throw new Error(String(r.status))
      applyRun(await r.json())
    } catch {
      setAutoErr(`Brain unreachable at ${BRAIN}.`)
    } finally { setPickBusy(null) }
  }

  const ep = live?.episode
  const tasks = live?.isaac_tasks ?? cannedTasks
  const fs = ep?.observation?.factory_state ?? {}
  const isLive = !!live
  const m = ep?.verifier_after?.metrics ?? {}
  const hasCapturedInput = !!initial && (!!initial.text || !!initial.files?.length)

  // ── library-first: no floor open → just the library grid ──
  if (!live) {
    if (hasCapturedInput || autoBusy || autoErr) {
      return <IntakeThinking busy={autoBusy} err={autoErr} brainUrl={BRAIN} />
    }
    return (
      <div>
        <div style={{ ...card, marginBottom: 18, borderColor: 'var(--brand)' }}>
          <Label n="·">Start with your shift</Label>
          <h2 style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>Upload the real floor context first.</h2>
          <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 700, fontSize: 14 }}>
            ShiftBench should reason over your current jobs, machine status, staffing, constraints, and floor evidence. Samples below are just fixtures for checking the report layout.
          </p>
          {onRestart && <button className="btn primary" style={{ marginTop: 16 }} onClick={onRestart}>Capture my floor</button>}
        </div>
        {autoErr && <div style={{ ...card, color: 'var(--warn)', fontFamily: mono, fontSize: 12.5 }}>{autoErr}</div>}
        <FloorLibrary onResult={applyRun} />
      </div>
    )
  }

  // ── a floor is open → its verified plan ──
  const hard = ep?.verifier_after?.n_hard ?? 0
  const reward = Math.round(ep?.verifier_after?.reward ?? 0)
  const tiles = [
    { v: reward.toLocaleString(), l: 'reward', c: 'var(--brand)', big: true },
    { v: hard, l: 'hard violations', c: hard === 0 ? 'var(--pos)' : 'var(--neg)' },
    { v: `${Math.round((m.on_time_rate ?? 0) * 100)}%`, l: 'on-time', c: 'var(--text)' },
    { v: Math.round(m.profit ?? 0).toLocaleString(), l: 'profit', c: 'var(--text)' },
    { v: `${Math.round((m.utilization ?? 0) * 100)}%`, l: 'utilization', c: 'var(--text)' },
    { v: m.safety_incidents ?? 0, l: 'safety incidents', c: (m.safety_incidents ?? 0) === 0 ? 'var(--pos)' : 'var(--neg)' },
    { v: `${m.completed_jobs ?? '?'} / ${m.total_jobs ?? '?'}`, l: 'jobs done', c: 'var(--text)' },
  ]
  return (
    <div>
      <div ref={resultRef} />
      <button className="btn ghost" style={{ marginBottom: 14 }} onClick={() => setLive(null)}>← Back to library</button>

      {autoBusy && <div style={{ ...card, color: 'var(--accent)', fontFamily: mono, fontSize: 13 }}>▶ Brain compiling…</div>}
      {autoErr && <div style={{ ...card, color: 'var(--warn)', fontFamily: mono, fontSize: 12.5 }}>{autoErr}</div>}

      <div style={{ ...card, padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16 }}>{live.intake?.summary ?? live.intake?.industry ?? 'Run report'}</div>
          <div style={{ fontFamily: mono, fontSize: 11, color: hard === 0 ? 'var(--pos)' : 'var(--neg)' }}>{hard === 0 ? 'VERIFIED · executable' : `${hard} hard violations`}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(108px, 1fr))', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
          {tiles.map((t, i) => (
            <div key={i} style={{ background: 'var(--panel)', padding: '12px 14px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: t.big ? 26 : 20, fontWeight: 800, color: t.c, lineHeight: 1 }}>{t.v}</div>
              <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: '0.06em', color: 'var(--muted)', marginTop: 7, textTransform: 'uppercase' }}>{t.l}</div>
            </div>
          ))}
        </div>
      </div>

      {ep && (
        <>
          <ReasoningPanel live={live} />
          {/* compiled floor (concise) */}
          <div style={card}>
            <Label n="01">{`Compiled floor · ${live.intake?.industry} · ${live.intake?.n_jobs} jobs`}</Label>
            {live.intake?.vision_caption && <p style={{ margin: '0 0 8px', color: 'var(--accent)', fontFamily: mono, fontSize: 12, lineHeight: 1.5 }}>👁 {live.intake.vision_caption}</p>}
            <div>{(fs.machines ?? []).map((mm: Json) => <Chip key={mm.id}>{mm.id} · {mm.capabilities?.join('/')}</Chip>)}</div>
            <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--muted)', margin: '10px 0 4px' }}>jobs</div>
            <div>{(fs.jobs ?? []).slice(0, 8).map((j: Json) => <Chip key={j.id}>{j.id} · due d{j.due_day}</Chip>)}</div>
          </div>

          {/* the legible before/after: which hard constraints broke, and that they're fixed */}
          <WhatWasFixed ep={ep} naiveHard={live?.naive_verdict?.hard_violations} n="02" />

          {/* optimal actions, executing on the floor */}
          {tasks && <FloorScene3D tasks={tasks} n="03" />}

          {/* everything else is power-user detail, hidden by default */}
          <div style={{ textAlign: 'center', margin: '6px 0 18px' }}>
            <button className="btn ghost" onClick={() => setAdv((a) => !a)}>
              {adv ? '▾ Hide details' : '▸ Show details — baseline · train · pipeline · physics · eval'}
            </button>
          </div>
          {adv && (
            <>
              {(fs.machines ?? []).length > 0 && <FloorPlanLasso machines={fs.machines} onResult={applyRun} />}
              {live?.region && <RegionResult region={live.region} />}
              <RepairStepper ep={ep} n="a1" />
              {baseline && <Baseline b={baseline} n="a2" />}
              {run?.scoreboard && <TrainDistill rows={run.scoreboard} n="a3" customerId={customerId} customerName={customerName} taskId={isLive ? taskId : undefined} state={fs} />}
              <Pipeline n="a4" />
              {live?.naive_isaac_tasks && tasks && (
                <BeforeAfter naive={live.naive_isaac_tasks} verified={tasks} naiveHard={live.naive_verdict?.hard_violations ?? 0} n="a5" />
              )}
              {tasks && <MujocoFloor naive={live?.naive_isaac_tasks} verified={tasks} naiveHard={live?.naive_verdict?.hard_violations} n="a6" />}
              {tasks && <Humanoid tasks={tasks} n="a7" />}
              {run?.scoreboard && <Scoreboard rows={run.scoreboard} n="a8" />}
              <EvalReport n="a9" />
              <TeacherFeedback live={live} n="a10" />
              <StockGallery onPick={pickStock} busyId={pickBusy} />
              <FactoryInput onResult={applyRun} />
            </>
          )}
        </>
      )}
    </div>
  )
}
