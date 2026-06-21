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
    let frames: BrainFile[] = []
    try { frames = await gatherFrames() } finally { setExtracting(false) }
    onAnalyze(req, manifest, frames)
  }

  return (
    <section className="capture">
      <div className="flow-shell" style={{ maxWidth: 720 }}>
        <button className="btn ghost back" onClick={onBack}>← Back</button>
        <h1 style={{ marginTop: 10 }}>New floor plan</h1>
        <p className="flow-sub">Describe your floor (machines, jobs, materials, what's off-limits), or attach a video/photos. The brain plans it.</p>

        <textarea
          autoFocus
          className="field-input"
          rows={6}
          placeholder="e.g. 4 CNC + 2 mold cells, ~16 jobs this week in ABS and Nylon, M2 overheating, one operator out Thursday. Never run M2 unattended; finish the Acme bracket order first."
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ width: '100%', marginTop: 6 }}
        />

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
          <input ref={inputRef} className="sr-only" type="file" multiple accept={VIDEO_ACCEPT}
            onChange={(e) => { if (e.currentTarget.files) addFiles(e.currentTarget.files); e.currentTarget.value = '' }} />
          <button className="btn" onClick={() => inputRef.current?.click()}>📎 Attach files{items.length ? ` (${items.length})` : ''}</button>
          <button className="btn primary hero-action" onClick={build} disabled={!canContinue || extracting}>
            {extracting ? 'Reading…' : 'Build the plan →'}
          </button>
          <span className="trust-note">Local only · nothing uploaded</span>
        </div>
      </div>
    </section>
  )
}
