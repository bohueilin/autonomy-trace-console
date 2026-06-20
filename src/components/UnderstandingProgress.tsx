import { useEffect, useState } from 'react'
import type { CaptureManifest } from '../captureManifest'
import type { WorkflowUnderstanding } from '../workflowDraft'

const CHECKS = [
  'Captured local file names, types, sizes, and Drive links',
  'Drafted site zones and safety constraints',
  'Mapped the workflow into observable robot steps',
  'Prepared finish, escalate, and refuse situations',
  'Queued a deterministic eval mapping for your approval',
]

export function UnderstandingProgress({
  manifest,
  draft,
  onContinue,
  onBack,
}: {
  manifest: CaptureManifest
  draft: WorkflowUnderstanding
  onContinue: () => void
  onBack: () => void
}) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setStep((s) => Math.min(CHECKS.length, s + 1)), 360)
    return () => window.clearInterval(timer)
  }, [])

  const done = step >= CHECKS.length

  return (
    <section className="understanding">
      <div className="flow-shell centered">
        <button className="btn ghost back" onClick={onBack}>
          ← Back to capture
        </button>
        <div className="flow-kicker">Understand</div>
        <h1>We drafted the workflow. You confirm every assumption next.</h1>
        <p className="flow-sub">
          Stage A uses a deterministic template proposal. No media bytes were read, no files were
          uploaded, and no model was called.
        </p>

        <div className="analysis-card">
          <div className="analysis-ring" aria-hidden="true">
            {done ? '✓' : step + 1}
          </div>
          <div>
            <strong>{manifest.items.length} declared input(s)</strong>
            <p>{draft.inputManifestSummary}</p>
          </div>
        </div>

        <ol className="analysis-list">
          {CHECKS.map((check, index) => (
            <li key={check} className={index < step ? 'done' : index === step ? 'active' : ''}>
              <span>{index < step ? '✓' : index + 1}</span>
              {check}
            </li>
          ))}
        </ol>

        <div className="flow-actions">
          <button className="btn primary hero-action" onClick={onContinue} disabled={!done}>
            Review proposed workflow
          </button>
          <span className="trust-note">Interpretation only · deterministic oracle judges later</span>
        </div>
      </div>
    </section>
  )
}

