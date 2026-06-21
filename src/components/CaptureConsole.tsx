import { useRef, useState } from 'react'
import {
  CAPTURE_ROLES,
  createCaptureManifest,
  driveLinkToCaptureItem,
  fileMetaToCaptureItem,
  type CaptureItem,
  type CaptureManifest,
  type CaptureRole,
} from '../captureManifest'
import {
  PHYSICAL_DOMAINS,
  ROBOT_EMBODIMENTS,
  getDomainTheme,
  getEmbodimentProfile,
  type EnvironmentRequirement,
  type PhysicalDomain,
  type RobotEmbodiment,
} from '../environmentPlan'
import { StockGallery, extractFrames, type BrainFile, type BrainInput } from './FactoryCeoPanel'
import { VoiceInput } from './VoiceInput'
import type { VoiceFields } from '../useVoiceWorkflow'

const ROLE_LABEL: Record<CaptureRole, string> = {
  workflow_video: 'Workflow video',
  site_photo: 'Site photo',
  floor_plan: 'Floor plan',
  sop: 'SOP / manual',
  forbidden_example: 'Forbidden example',
  robot_profile: 'Robot profile',
  google_drive: 'Google Drive',
}

const VIDEO_ACCEPT =
  'video/mp4,video/quicktime,video/webm,video/x-msvideo,video/mpeg,image/*,application/pdf,text/plain,.mov,.mp4,.webm,.avi,.mpeg,.pdf,.txt,.md'

function formatSize(size: number | null): string {
  if (size == null) return 'linked'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function CaptureConsole({
  onAnalyze,
  onManual,
  onBack,
}: {
  onAnalyze: (req: EnvironmentRequirement, manifest: CaptureManifest, frames?: BrainFile[]) => void
  onManual: (req: EnvironmentRequirement, manifest: CaptureManifest, frames?: BrainFile[]) => void
  onBack: () => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const blobs = useRef<Record<string, File>>({})
  const [stockFrames, setStockFrames] = useState<BrainFile[]>([])
  const [extracting, setExtracting] = useState(false)
  const [outcome, setOutcome] = useState(
    'A robot assistant for my dad’s factory that can move totes safely without entering operator-only cells.',
  )
  const [description, setDescription] = useState(
    'Dad receives a tote, checks the lane, carries it to packing, and stops when a forklift lane or operator-only cell is active.',
  )
  const [rules, setRules] = useState('Never enter operator-only cells\nEscalate if a forklift lane blocks the route')
  const [domain, setDomain] = useState<PhysicalDomain>('manufacturing')
  const [embodiment, setEmbodiment] = useState<RobotEmbodiment>('humanoid')
  const [items, setItems] = useState<CaptureItem[]>([])
  const [driveUrl, setDriveUrl] = useState('')
  const [dragging, setDragging] = useState(false)

  const theme = getDomainTheme(domain)
  const profile = getEmbodimentProfile(embodiment)
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
      attachments: items.map((item) => `${ROLE_LABEL[item.role]}: ${item.name}`),
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
    const out: BrainFile[] = [...stockFrames]
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

  function addDriveLink() {
    const item = driveLinkToCaptureItem(driveUrl, items.length)
    if (!item) return
    setItems((prev) => [...prev, item])
    setDriveUrl('')
  }

  function updateRole(id: string, role: CaptureRole) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, role } : item)))
  }

  function fileToDataUrl(f: File): Promise<string> {
    return new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f) })
  }

  function applyVoice(f: VoiceFields) {
    if (f.outcome) setOutcome(f.outcome)
    if (f.description) setDescription(f.description)
    if (f.safetyRules && f.safetyRules.length) setRules(f.safetyRules.join('\n'))
  }

  function pickStock(clip: any, input: BrainInput) {
    setStockFrames(input.files)
    if (!description.trim() || description.startsWith('Dad receives')) setDescription(clip.summary || clip.title)
    setOutcome((o) => (o && !o.startsWith('A robot assistant for my dad')) ? o : `Keep the ${clip.title.toLowerCase()} floor running unattended, safely, while the operator is away.`)
  }

  async function submit(mode: 'analyze' | 'manual') {
    if (!canContinue) return
    setExtracting(true)
    const payload = buildManifest()
    let frames: BrainFile[] = []
    try { frames = await gatherFrames() } finally { setExtracting(false) }
    if (mode === 'manual') onManual(payload.req, payload.manifest, frames)
    else onAnalyze(payload.req, payload.manifest, frames)
  }

  return (
    <section className="capture">
      <div className="flow-shell">
        <button className="btn ghost back" onClick={onBack}>
          ← Back
        </button>
        <div className="flow-kicker">Capture</div>
        <h1>Describe the site before the robot ever steps on it.</h1>
        <p className="flow-sub">
          Upload workflow video, photos, SOPs, floor plans, or start from a stock floor below. Video
          frames are sampled in your browser and read by the multimodal brain, the raw file never leaves the page.
        </p>

        <div className="capture-layout">
          <div
            className={`upload-zone ${dragging ? 'dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              addFiles(e.dataTransfer.files)
            }}
          >
            <div className="upload-orb">↑</div>
            <h2>Upload workflow video</h2>
            <p>MP4, MOV, WebM, AVI, images, PDFs, and text notes. Video frames are sampled locally and read by the brain.</p>
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              multiple
              accept={VIDEO_ACCEPT}
              onChange={(e) => {
                if (e.currentTarget.files) addFiles(e.currentTarget.files)
                e.currentTarget.value = ''
              }}
            />
            <button className="btn primary" onClick={() => inputRef.current?.click()}>
              Select video or files
            </button>
            <div className="drive-row">
              <input
                className="field-input"
                value={driveUrl}
                placeholder="Paste Google Drive link"
                onChange={(e) => setDriveUrl(e.target.value)}
              />
              <button className="btn" onClick={addDriveLink}>
                Add link
              </button>
            </div>
          </div>

          <div className="capture-form">
            <label className="field">
              <span className="field-label">Outcome requirement</span>
              <textarea
                className="field-input"
                rows={3}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">What happens in the workflow?</span>
              <textarea
                className="field-input"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Safety rules</span>
              <textarea
                className="field-input"
                rows={3}
                value={rules}
                onChange={(e) => setRules(e.target.value)}
              />
            </label>
            <div className="capture-selects">
              <label className="field">
                <span className="field-label">Deployment context</span>
                <select className="field-input" value={domain} onChange={(e) => setDomain(e.target.value as PhysicalDomain)}>
                  {PHYSICAL_DOMAINS.map((d) => (
                    <option key={d} value={d}>
                      {getDomainTheme(d).label}
                    </option>
                  ))}
                </select>
                <span className="field-hint">{theme.blurb}</span>
              </label>
              <label className="field">
                <span className="field-label">Expected robot</span>
                <select
                  className="field-input"
                  value={embodiment}
                  onChange={(e) => setEmbodiment(e.target.value as RobotEmbodiment)}
                >
                  {ROBOT_EMBODIMENTS.map((e) => (
                    <option key={e} value={e}>
                      {getEmbodimentProfile(e).label}
                    </option>
                  ))}
                </select>
                <span className="field-hint">{profile.note}</span>
              </label>
            </div>
          </div>
        </div>

        <VoiceInput onFields={applyVoice} />
        <StockGallery onPick={pickStock} />
        {stockFrames.length > 0 && (
          <div className="trust-note" style={{ marginTop: 8 }}>
            ✓ {stockFrames.length} frames sampled from the stock clip, the brain will read them.
          </div>
        )}

        <div className="capture-items">
          {items.length === 0 ? (
            <div className="empty-upload">No inputs yet. You can still map the workflow manually.</div>
          ) : (
            items.map((item) => (
              <div className="capture-card" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.type} · {formatSize(item.size)}</span>
                </div>
                <select value={item.role} onChange={(e) => updateRole(item.id, e.target.value as CaptureRole)}>
                  {CAPTURE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABEL[role]}
                    </option>
                  ))}
                </select>
                <button className="btn ghost" onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}>
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flow-actions">
          <button className="btn primary hero-action" onClick={() => submit('analyze')} disabled={!canContinue || extracting}>
            {extracting ? 'Reading footage…' : 'Analyze workflow'}
          </button>
          <button className="btn ghost" onClick={() => submit('manual')} disabled={!canContinue || extracting}>
            Map manually instead
          </button>
          <span className="trust-note">Local metadata only · no upload · no model spend</span>
        </div>
      </div>
    </section>
  )
}

