// Phase 1 intake — outcome-based requirement + domain + embodiment + input
// placeholders. Generates a deterministic EnvironmentRequirement. No file parsing
// or upload happens in this phase; attachments are captured as intent only.

import { useState } from 'react'
import {
  PHYSICAL_DOMAINS,
  ROBOT_EMBODIMENTS,
  getDomainTheme,
  getEmbodimentProfile,
  type EnvironmentRequirement,
  type PhysicalDomain,
  type RobotEmbodiment,
} from '../environmentPlan'

const EMBODIMENT_LABELS: Record<RobotEmbodiment, string> = {
  humanoid: 'Humanoid',
  carrier: 'Carrier',
  dog: 'Robot dog',
  amr: 'AMR',
  arm: 'Mobile arm',
  drone: 'Drone',
  other: 'Other / custom',
}

const ATTACHMENT_OPTIONS = [
  'Task descriptions',
  'SOPs & safety manuals',
  'Workspace images / video',
  'Floor plan',
  'Unsafe / forbidden examples',
  'Robot hardware profile',
]

const PLACEHOLDER_OUTCOME =
  'e.g. I want a robot assistant for my dad’s factory that can lift, move, carry, and inspect parts safely without entering operator-only cells.'

export function IntakeForm({
  onGenerate,
  onBack,
}: {
  onGenerate: (req: EnvironmentRequirement) => void
  onBack: () => void
}) {
  const [outcome, setOutcome] = useState('')
  const [domain, setDomain] = useState<PhysicalDomain>('manufacturing')
  const [embodiment, setEmbodiment] = useState<RobotEmbodiment>('humanoid')
  const [notes, setNotes] = useState('')
  const [attachments, setAttachments] = useState<string[]>([])

  const theme = getDomainTheme(domain)
  const profile = getEmbodimentProfile(embodiment)
  const canGenerate = outcome.trim().length >= 8

  function toggleAttachment(label: string) {
    setAttachments((prev) =>
      prev.includes(label) ? prev.filter((a) => a !== label) : [...prev, label],
    )
  }

  function submit() {
    if (!canGenerate) return
    onGenerate({
      outcome: outcome.trim(),
      domain,
      embodiment,
      notes: notes.trim() || undefined,
      attachments: attachments.length ? [...attachments] : undefined,
    })
  }

  return (
    <section className="intake">
      <div className="intake-head">
        <button className="btn ghost back" onClick={onBack}>
          ← Back
        </button>
        <div>
          <div className="section-title">Create Physical AI License Eval</div>
          <h2>Tell us the outcome you need — we build the environment.</h2>
        </div>
      </div>

      <div className="intake-grid">
        <label className="field field-wide">
          <span className="field-label">Outcome requirement</span>
          <textarea
            className="field-input"
            rows={3}
            value={outcome}
            placeholder={PLACEHOLDER_OUTCOME}
            onChange={(e) => setOutcome(e.target.value)}
          />
          <span className="field-hint">Describe the job to be done, not the steps.</span>
        </label>

        <label className="field">
          <span className="field-label">Deployment context</span>
          <select
            className="field-input"
            value={domain}
            onChange={(e) => setDomain(e.target.value as PhysicalDomain)}
          >
            {PHYSICAL_DOMAINS.map((d) => (
              <option key={d} value={d}>
                {getDomainTheme(d).label}
              </option>
            ))}
          </select>
          <span className="field-hint">{theme.blurb}</span>
        </label>

        <label className="field">
          <span className="field-label">Robot embodiment</span>
          <select
            className="field-input"
            value={embodiment}
            onChange={(e) => setEmbodiment(e.target.value as RobotEmbodiment)}
          >
            {ROBOT_EMBODIMENTS.map((e) => (
              <option key={e} value={e}>
                {EMBODIMENT_LABELS[e]}
              </option>
            ))}
          </select>
          <span className="field-hint">{profile.note}</span>
        </label>

        <label className="field field-wide">
          <span className="field-label">Operator notes (optional)</span>
          <textarea
            className="field-input"
            rows={2}
            value={notes}
            placeholder="Site constraints, escalation rules, lifting limits, shift windows…"
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <div className="field field-wide">
          <span className="field-label">
            Inputs you’ll provide <span className="field-soon">placeholder · not parsed yet</span>
          </span>
          <div className="attach-grid">
            {ATTACHMENT_OPTIONS.map((label) => {
              const on = attachments.includes(label)
              return (
                <button
                  type="button"
                  key={label}
                  className={`attach-chip ${on ? 'on' : ''}`}
                  aria-pressed={on}
                  onClick={() => toggleAttachment(label)}
                >
                  <span className="attach-box" aria-hidden="true">
                    {on ? '✓' : '+'}
                  </span>
                  {label}
                </button>
              )
            })}
          </div>
          <span className="field-hint">
            Captured as intent for the environment plan. Real ingestion (file parsing, vision) is a
            later phase — this iteration runs a deterministic template.
          </span>
        </div>
      </div>

      <div className="intake-cta">
        <button className="btn primary" onClick={submit} disabled={!canGenerate}>
          Generate environment →
        </button>
        {!canGenerate && <span className="field-hint">Add an outcome to continue.</span>}
      </div>
    </section>
  )
}
