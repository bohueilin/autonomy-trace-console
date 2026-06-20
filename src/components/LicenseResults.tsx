// Phase 2 license results — reuses the existing demo outputs, scoped to the
// generated plan: triptych, FAR/FRR baseline board, confusion matrix, reward-
// hacking trace, Signal Extractor counts, and a readiness/license summary.

import { useState } from 'react'
import { computeLicenseFromVerdicts, type LicenseVerdict } from '../license'
import type { WarehouseDemo, WarehouseRollout } from '../warehouse'
import type { EnvironmentPlan } from '../environmentPlan'
import { buildPhysicalAiLicenseReport } from '../licenseReport'
import { MatrixMini, TriptychCard } from './warehouseViz'
import { actionTrace, pct } from '../format'

function toVerdicts(rollouts: readonly WarehouseRollout[]): LicenseVerdict[] {
  return rollouts.map((r) => ({
    passed: r.passed,
    reward: r.reward,
    catastrophic: r.category === 'unsafe_zone' || r.falseAccept,
  }))
}

function reportFilename(reportId: string): string {
  return `${reportId.replace(/[^a-z0-9_-]+/gi, '_')}.json`
}

export function LicenseResults({
  plan,
  demo,
  onRefine,
  onRestart,
  onSample,
}: {
  plan: EnvironmentPlan
  demo: WarehouseDemo
  onRefine: () => void
  onRestart: () => void
  onSample: () => void
}) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const oracle = demo.baselines.find((b) => b.name === 'calibrated oracle') ?? demo.baselines[0]
  const license = computeLicenseFromVerdicts(toVerdicts(oracle.rollouts))
  const report = buildPhysicalAiLicenseReport(plan, demo)
  const reportJson = JSON.stringify(report, null, 2)

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(reportJson)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  function downloadReport() {
    const blob = new Blob([reportJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = reportFilename(report.reportId)
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="results">
      <div className="intake-head">
        <button className="btn ghost back" onClick={onRefine}>
          ← Adjust environment
        </button>
        <div>
          <div className="section-title">
            Autonomy License report · {plan.theme.label} · {plan.profile.label}
          </div>
          <h2>{plan.requirement.outcome}</h2>
        </div>
      </div>

      <div className="results-summary">
        <div className="results-license" style={{ borderColor: license.level.color }}>
          <span className="chip-badge" style={{ background: license.level.color }}>
            {license.level.id}
          </span>
          <div>
            <div className="chip-eyebrow">Reference ceiling for this environment</div>
            <div className="license-name" style={{ color: license.level.color }}>
              {license.level.name}
            </div>
            <p className="results-license-note">
              The calibrated oracle earns this tier here. A real model is scored against the same
              env via the model path (next phase); no model has been run yet.
            </p>
          </div>
        </div>
        <div className="results-decision">
          <div className="panel-kicker">Reference readiness</div>
          <div className={`decision-badge decision-${report.decision}`}>{report.decisionLabel}</div>
          <p>{report.summary}</p>
          <div className="decision-metrics">
            <span>FAR {pct(report.calibration.far)}</span>
            <span>FRR {pct(report.calibration.frr)}</span>
            <span>Avg {report.calibration.avgReward.toFixed(2)}</span>
          </div>
        </div>
        <div className="results-readiness">
          <div className="panel-kicker">Readiness read-out</div>
          <ul>
            <li>
              <span className="lbl-finish">May do autonomously</span> tasks the oracle labels{' '}
              <strong>finish</strong> ({plan.labelCounts.finish})
            </li>
            <li>
              <span className="lbl-escalate">Must escalate</span> when no safe route fits the robot
              budget ({plan.labelCounts.escalate})
            </li>
            <li>
              <span className="lbl-refuse">Must refuse</span> hazard / human-only targets (
              {plan.labelCounts.refuse})
            </li>
          </ul>
        </div>
      </div>

      <div className="report-strip">
        <div className="report-card">
          <div className="panel-kicker">Operating envelope</div>
          <ul>
            {report.operatingEnvelope.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div className="report-card">
          <div className="panel-kicker">Pilot next steps</div>
          <ol>
            {report.nextSteps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>
        <details className="report-card report-json">
          <summary>
            <span>
              Report JSON · {report.trainingData.failureTags} tags ·{' '}
              {report.trainingData.preferencePairs} pairs · {report.trainingData.rewardRows} reward rows
            </span>
          </summary>
          <div className="report-actions">
            <button className="btn" onClick={copyReport}>
              Copy JSON
            </button>
            <button className="btn ghost" onClick={downloadReport}>
              Download
            </button>
            <span className={`copy-status copy-${copyStatus}`}>
              {copyStatus === 'copied'
                ? 'Copied'
                : copyStatus === 'failed'
                  ? 'Clipboard unavailable'
                  : reportFilename(report.reportId)}
            </span>
          </div>
          <pre>{reportJson}</pre>
        </details>
      </div>

      <p className="report-disclaimer">{report.disclaimer}</p>

      <div className="triptych">
        {demo.triptych.map((item) => (
          <TriptychCard
            key={item.slot}
            slot={item.slot}
            title={item.title}
            line={item.line}
            rollout={item.rollout}
          />
        ))}
      </div>

      <div className="warehouse-grid">
        <div className="warehouse-panel">
          <div className="panel-kicker">Headline calibration (FAR / FRR)</div>
          <div className="baseline-list">
            {demo.baselines.map((b) => (
              <div className="baseline-row" key={b.name}>
                <span>{b.name}</span>
                <span>FAR {pct(b.matrix.far)}</span>
                <span>FRR {pct(b.matrix.frr)}</span>
                <span>avg {b.avgReward.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <MatrixMini matrix={oracle.matrix} />
        </div>

        <div className="warehouse-panel">
          <div className="panel-kicker">Reward-hacking trace</div>
          <h3>{demo.rewardHack.task.title}</h3>
          <p>
            A fake terminal finish without pick/drop gets outcome 0, so shaping cannot rescue it:
            reward {demo.rewardHack.reward.toFixed(2)}.
          </p>
          <p className="trip-trace">{actionTrace(demo.rewardHack.actions)}</p>
          <div className="trip-stats">
            <span>{demo.rewardHack.category}</span>
            <span>oracle {demo.rewardHack.expected}</span>
            <span>actual {demo.rewardHack.matrixAction}</span>
          </div>
        </div>

        <div className="warehouse-panel">
          <div className="panel-kicker">Signal Extractor</div>
          <div className="signal-grid">
            <span>{demo.signal.failureTags.length}</span>
            <span>failure tags</span>
            <span>{demo.signal.preferencePairs.length}</span>
            <span>preference pairs</span>
            <span>{demo.signal.rewardViews.length}</span>
            <span>GRPO/RFT reward rows</span>
          </div>
          <p className="signal-note">
            {demo.signal.failureTags[0]?.tags.join(', ') ?? 'no failures'} {'->'}{' '}
            {demo.signal.preferencePairs[0]?.reason ?? 'oracle replay clean'}
          </p>
        </div>

        <div className="warehouse-panel aiuc-panel">
          <div className="panel-kicker">AIUC wedge</div>
          <p>{demo.aiucWedge}</p>
          <p className="signal-note">
            Generated client-side from the deterministic oracle. Evidence persistence + a live model
            path plug into this report in the next phase.
          </p>
        </div>
      </div>

      <div className="intake-cta">
        <button className="btn" onClick={onRestart}>
          Start a new eval
        </button>
        <button className="btn ghost" onClick={onSample}>
          View sample warehouse demo
        </button>
      </div>
    </section>
  )
}
