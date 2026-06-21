// Minimal "new floor plan" input: a textarea + optional files → Build. No stock
// gallery, no marketing — just enter a plan and go. The brain reads any frames.
import { useRef, useState } from 'react'
import { createCaptureManifest, fileMetaToCaptureItem, type CaptureItem, type CaptureManifest } from '../captureManifest'
import type { EnvironmentRequirement, PhysicalDomain, RobotEmbodiment } from '../environmentPlan'
import { extractFrames, type BrainFile } from './FactoryCeoPanel'

const VIDEO_ACCEPT =
  'video/mp4,video/quicktime,video/webm,video/x-msvideo,video/mpeg,image/*,application/pdf,text/plain,.mov,.mp4,.webm,.avi,.mpeg,.pdf,.txt,.md'
const DOMAIN: PhysicalDomain = 'manufacturing'
const EMBODIMENT: RobotEmbodiment = 'humanoid'

export function CaptureConsole({
  onAnalyze,
  onBack,
}: {
  onAnalyze: (req: EnvironmentRequirement, manifest: CaptureManifest, frames?: BrainFile[]) => void
  onManual: (req: EnvironmentRequirement, manifest: CaptureManifest, frames?: BrainFile[]) => void
  onBack: () => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const blobs = useRef<Record<string, File>>({})
  const [extracting, setExtracting] = useState(false)
  const [text, setText] = useState('')
  const [items, setItems] = useState<CaptureItem[]>([])
  const canContinue = text.trim().length >= 8 || items.length > 0

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files)
    const next = arr.map((f, i) => fileMetaToCaptureItem({ name: f.name, type: f.type, size: f.size }, items.length + i))
    next.forEach((item, i) => { const f = arr[i]; if (f.type.startsWith('video/') || f.type.startsWith('image/')) blobs.current[item.id] = f })
    setItems((prev) => [...prev, ...next])
  }

  function fileToDataUrl(f: File): Promise<string> {
    return new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f) })
  }

  async function gatherFrames(): Promise<BrainFile[]> {
    const out: BrainFile[] = []
    for (const item of items) {
      const f = blobs.current[item.id]
      if (!f) continue
      const url = URL.createObjectURL(f)
      try {
        if (f.type.startsWith('image/')) out.push({ name: f.name, kind: 'image', content: await fileToDataUrl(f) })
        else if (f.type.startsWith('video/')) (await extractFrames(url, 2)).forEach((fr, i) => out.push({ name: `${f.name}-frame${i}.jpg`, kind: 'image', content: fr }))
      } finally { URL.revokeObjectURL(url) }
    }
    return out
  }

  async function build() {
    if (!canContinue) return
    setExtracting(true)
    const outcome = text.trim() || 'Plan this floor safely.'
    const req: EnvironmentRequirement = { outcome, domain: DOMAIN, embodiment: EMBODIMENT, notes: outcome, attachments: items.map((i) => i.name) }
    const manifest = createCaptureManifest({ outcome, domain: DOMAIN, expectedEmbodiment: EMBODIMENT, description: outcome, safetyRules: [], items })
    const frames = await gatherFrames().finally(() => setExtracting(false))
    onAnalyze(req, manifest, frames)
  }

  return (
    <section className="capture">
      <div className="capture-shell">
        <button className="btn ghost back" onClick={onBack}>← Back</button>
        <div className="capture-head">
          <span className="flow-kicker">New floor capture</span>
          <h1>Give the brain a shift brief.</h1>
          <p className="flow-sub">
            Write what a lead operator would say at handoff: what must ship, which machines are risky,
            who is unavailable, and where a robot must never go.
          </p>
        </div>

        <div className="capture-workspace">
          <div className="brief-card">
            <label className="field">
              <span className="field-label">Shift brief</span>
              <textarea
                autoFocus
                className="field-input shift-brief"
                rows={8}
                placeholder="Example: 4 CNC + 2 mold cells, 16 jobs this week in ABS and Nylon. M2 is overheating, one operator is out Thursday, and the Acme bracket order ships first. Never run M2 unattended."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <span className="field-hint">
                Include priorities, blocked areas, machine status, operator coverage, material constraints, and escalation rules.
              </span>
            </label>

            <div className="capture-actions">
              <input ref={inputRef} className="sr-only" type="file" multiple accept={VIDEO_ACCEPT}
                onChange={(e) => { if (e.currentTarget.files) addFiles(e.currentTarget.files); e.currentTarget.value = '' }} />
              <button className="btn" onClick={() => inputRef.current?.click()}>
                Attach photos, video, SOPs{items.length ? ` (${items.length})` : ''}
              </button>
              <button className="btn primary hero-action" onClick={build} disabled={!canContinue || extracting}>
                {extracting ? 'Reading floor evidence…' : 'Build verified plan →'}
              </button>
            </div>
          </div>

          <aside className="brief-guide" aria-label="What to include">
            <div className="panel-kicker">What makes a good brief</div>
            <ul>
              <li><strong>Demand:</strong> orders, due dates, takt pressure, priority customers.</li>
              <li><strong>Capacity:</strong> machines, robots, operators, absences, maintenance windows.</li>
              <li><strong>Risk:</strong> hot zones, human-only cells, unsafe shortcuts, irreversible actions.</li>
              <li><strong>Evidence:</strong> floor video, photos, SOPs, part lists, or current dispatch board.</li>
            </ul>
            <div className="local-proof">
              <strong>Local preview</strong>
              <span>Files are sampled in-browser for this prototype. The verifier still decides if the plan is safe.</span>
            </div>
          </aside>
        </div>

        {items.length > 0 && (
          <div className="attached-list" aria-label="Attached files">
            {items.map((item) => (
              <span key={item.id}>{item.name}</span>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
