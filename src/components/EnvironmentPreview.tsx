// Phase 2 environment preview — the operator reviews the generated eval before
// running it: themed tasks, hazards/human-only zones, terminal labels, and the
// oracle assumptions that make the ground truth defensible.

import { bfsOracle } from '../warehouse'
import type { EnvironmentPlan } from '../environmentPlan'

const LABEL_CLASS: Record<string, string> = {
  finish: 'lbl-finish',
  escalate: 'lbl-escalate',
  refuse: 'lbl-refuse',
}

export function EnvironmentPreview({
  plan,
  onRun,
  onBack,
}: {
  plan: EnvironmentPlan
  onRun: () => void
  onBack: () => void
}) {
  const { theme, profile, tasks, labelCounts, requirement } = plan

  return (
    <section className="preview">
      <div className="intake-head">
        <button className="btn ghost back" onClick={onBack}>
          ← Edit inputs
        </button>
        <div>
          <div className="section-title">Generated environment · {theme.label}</div>
          <h2>{requirement.outcome}</h2>
        </div>
      </div>

      <div className="preview-meta">
        <div className="preview-card">
          <div className="panel-kicker">Plan</div>
          <p className="preview-line">
            <strong>{tasks.length}</strong> tasks · <strong>{profile.label}</strong> embodiment ·{' '}
            <code>{plan.id}</code>
          </p>
          <div className="preview-counts">
            <span className="lbl-finish">{labelCounts.finish} finish</span>
            <span className="lbl-escalate">{labelCounts.escalate} escalate</span>
            <span className="lbl-refuse">{labelCounts.refuse} refuse</span>
          </div>
        </div>
        <div className="preview-card">
          <div className="panel-kicker">Domain vocabulary</div>
          <ul className="preview-vocab">
            <li>
              <span>Item</span>
              {theme.itemTerm}
            </li>
            <li>
              <span>Hazard</span>
              {theme.hazardTerm}
            </li>
            <li>
              <span>Human-only</span>
              {theme.humanOnlyTerm}
            </li>
          </ul>
        </div>
        <div className="preview-card">
          <div className="panel-kicker">Oracle assumptions</div>
          <ul className="preview-assumptions">
            {plan.oracleAssumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="preview-tasks">
        <div className="ptask-row ptask-head">
          <span>Task</span>
          <span>Level</span>
          <span>Oracle</span>
          <span>Battery</span>
          <span>Steps</span>
          <span>Hazards</span>
          <span>Human-only</span>
        </div>
        {tasks.map((task) => {
          const label = bfsOracle(task).label
          return (
            <div className="ptask-row" key={task.id}>
              <span className="ptask-title">{task.title}</span>
              <span>{task.level}</span>
              <span className={LABEL_CLASS[label]}>{label}</span>
              <span>{task.battery}</span>
              <span>{task.maxSteps}</span>
              <span>{task.hazards.length}</span>
              <span>{task.humanOnly.length}</span>
            </div>
          )
        })}
      </div>

      <div className="intake-cta">
        <button className="btn primary" onClick={onRun}>
          ▶ Run license eval
          <span className="server-tag">deterministic · no spend</span>
        </button>
        <span className="field-hint">
          Runs blind baselines + the calibrated oracle through the pure verifier — no model calls.
        </span>
      </div>
    </section>
  )
}
