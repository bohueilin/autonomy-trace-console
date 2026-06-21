import { useRef, useState } from 'react'
import {
  createCaptureManifest,
  fileMetaToCaptureItem,
  type CaptureItem,
  type CaptureManifest,
} from '../captureManifest'
import type { EnvironmentRequirement, PhysicalDomain, RobotEmbodiment } from '../environmentPlan'
import { StockGallery, extractFrames, type BrainFile, type BrainInput } from './FactoryCeoPanel'
import { VoiceInput } from './VoiceInput'
import type { VoiceFields } from '../useVoiceWorkflow'

const VIDEO_ACCEPT =
  'video/mp4,video/quicktime,video/webm,video/x-msvideo,video/mpeg,image/*,application/pdf,text/plain,.mov,.mp4,.webm,.avi,.mpeg,.pdf,.txt,.md'

// Fixed defaults (selectors removed for a minimal capture; the brain keys off the
// free-form text, not these codex manifest fields).
const DOMAIN: PhysicalDomain = 'manufacturing'
const EMBODIMENT: RobotEmbodiment = 'humanoid'

export function CaptureConsole({
  onAnalyze,
  onManual: _onManual,
  onBack,
}: {
  onAnalyze: (req: EnvironmentRequirement, manifest: CaptureManifest, frames?: BrainFile[]) => void
  onManual: (req: EnvironmentRequirement, manifest: CaptureManifest, frames?: BrainFile[]) => void
  onBack: () => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const blobs = useRef<Record<string, File>>({})
  const [extracting, setExtracting] = useState(false)
  const [outcome, setOutcome] = useState(
    'A robot assistant for my dad’s factory that can move totes safely without entering operator-only cells.',
  )
  const [description, setDescription] = useState('')
  const [rules, setRules] = useState('')
  const [items, setItems] = useState<CaptureItem[]>([])
  const domain = DOMAIN, embodiment = EMBODIMENT
  const canContinue = outcome.trim().length >= 8

  function buildManifest(): { req: EnvironmentRequirement; manifest: CaptureManifest } {
    const safetyRules = rules
      .split('\n')
      .map((r) => r.trim())
      .filter(Boolean)
    const req: EnvironmentRequirement = {
      outcome: outcome.trim(),
      domain,
      embodiment,
      notes: description.trim() || undefined,
      attachments: items.map((item) => item.name),
    }
    const manifest = createCaptureManifest({
      outcome: req.outcome,
      domain,
      expectedEmbodiment: embodiment,
      description,
      safetyRules,
      items,
    })
    return { req, manifest }
  }

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files)
    const next = arr.map((file, index) =>
      fileMetaToCaptureItem(
        { name: file.name, type: file.type, size: file.size },
        items.length + index,
      ),
    )
    next.forEach((item, i) => {
      const f = arr[i]
      if (f.type.startsWith('video/') || f.type.startsWith('image/')) blobs.current[item.id] = f
    })
    setItems((prev) => [...prev, ...next])
  }

  // Real multimodal: sample frames from any uploaded video/image (browser-side) and
  // combine with frames from a chosen stock clip, these feed the brain's VLM intake.
  async function gatherFrames(): Promise<BrainFile[]> {
    const out: BrainFile[] = []
    for (const item of items) {
      const f = blobs.current[item.id]
      if (!f) continue
      const url = URL.createObjectURL(f)
      try {
        if (f.type.startsWith('image/')) {
          out.push({ name: f.name, kind: 'image', content: await fileToDataUrl(f) })
        } else if (f.type.startsWith('video/')) {
          const frames = await extractFrames(url, 2)
          frames.forEach((fr, i) => out.push({ name: `${f.name}-frame${i}.jpg`, kind: 'image', content: fr }))
        }
      } finally { URL.revokeObjectURL(url) }
    }
    return out
  }

  function fileToDataUrl(f: File): Promise<string> {
    return new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f) })
  }

  function applyVoice(f: VoiceFields) {
    if (f.outcome) setOutcome(f.outcome)
    if (f.description) setDescription(f.description)
    if (f.safetyRules && f.safetyRules.length) setRules(f.safetyRules.join('\n'))
  }

  // "Use this floor" should DO something: compile the clip's frames and go straight
  // to the studio (no extra "build" click needed).
  function pickStock(clip: any, input: BrainInput) {
    const outcomeText = `Keep the ${String(clip.title).toLowerCase()} floor running unattended, safely.`
    const req: EnvironmentRequirement = {
      outcome: outcomeText, domain, embodiment,
      notes: clip.summary || clip.title, attachments: [],
    }
    const manifest = createCaptureManifest({
      outcome: outcomeText, domain, expectedEmbodiment: embodiment,
      description: clip.summary || clip.title, safetyRules: [], items: [],
    })
    onAnalyze(req, manifest, input.files)
  }

  async function submit(_mode: 'analyze' | 'manual') {
    if (!canContinue) return
    setExtracting(true)
    const payload = buildManifest()
    let frames: BrainFile[] = []
    try { frames = await gatherFrames() } finally { setExtracting(false) }
    onAnalyze(payload.req, payload.manifest, frames)
  }

  return (
    <section className="capture">
      <div className="flow-shell">
        <button className="btn ghost back" onClick={onBack}>← Back</button>
        <div className="flow-kicker">Capture</div>
        <h1>Describe your floor.</h1>
        <p className="flow-sub">Pick a stock floor, or describe yours. Frames are read locally; nothing is uploaded.</p>

        <StockGallery onPick={pickStock} />

        <label className="field" style={{ marginTop: 18 }}>
          <span className="field-label">What should the robot do, and what is off-limits?</span>
          <textarea
            className="field-input"
            rows={4}
            placeholder="e.g. Move totes from receiving to packing on the injection-molding floor. Never enter operator-only cells; escalate if a forklift lane is active."
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
          />
        </label>

        <div className="capture-actions-row" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
          <input ref={inputRef} className="sr-only" type="file" multiple accept={VIDEO_ACCEPT}
            onChange={(e) => { if (e.currentTarget.files) addFiles(e.currentTarget.files); e.currentTarget.value = '' }} />
          <button className="btn" onClick={() => inputRef.current?.click()}>📎 Add files{items.length ? ` (${items.length})` : ''}</button>
          <VoiceInput onFields={applyVoice} />
        </div>

        <div className="flow-actions" style={{ marginTop: 18 }}>
          <button className="btn primary hero-action" onClick={() => submit('analyze')} disabled={!canContinue || extracting}>
            {extracting ? 'Reading footage…' : 'Build the plan →'}
          </button>
          <span className="trust-note">Local only · no upload · the verifier judges</span>
        </div>
      </div>
    </section>
  )
}

