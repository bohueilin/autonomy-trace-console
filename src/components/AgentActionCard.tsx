import { POLICY_BANDS } from '../agent'
import type { AgentDecision } from '../types'

interface Props {
  decision: AgentDecision | null
}

export function AgentActionCard({ decision }: Props) {
  return (
    <div className="card action-card">
      <div className="card-head">
        <span className="step-tag">2 · Agent action</span>
        <span className="muted-tag">mock policy · visible signals only</span>
      </div>

      {decision ? (
        <>
          <div className={`action-badge action-${decision.action}`}>{decision.action}</div>

          {/* Transparent mock-policy signal: the entire decision rule, made visible. */}
          <div className="policy-signal">
            <div className="policy-label">Mock policy signal</div>
            <div className="band-bar" role="img" aria-label={decision.policyBand}>
              {POLICY_BANDS.map((b) => {
                const width = (b.to >= 1 ? 1 : b.to) - b.from
                const active = decision.action === b.action
                return (
                  <div
                    key={b.action}
                    className={`band band-${b.action} ${active ? 'band-active' : ''}`}
                    style={{ width: `${width * 100}%` }}
                    title={`${b.from.toFixed(2)}–${b.to >= 1 ? '1.00' : b.to.toFixed(2)}: ${b.action}`}
                  >
                    {b.action}
                  </div>
                )
              })}
              <div
                className="band-marker"
                style={{ left: `${Math.min(decision.policySignal, 1) * 100}%` }}
              />
            </div>
            <div className="policy-readout">{decision.policyBand}</div>
          </div>

          <div className="confidence-row">
            <span className="muted">confidence</span>
            <div className="confidence-bar">
              <div className="confidence-fill" style={{ width: `${decision.confidence * 100}%` }} />
            </div>
            <span className="confidence-pct">{Math.round(decision.confidence * 100)}%</span>
          </div>

          <p className="agent-rationale">{decision.rationale}</p>
          <p className="policy-note">
            Heuristic stand-in for a learned policy. It reads only the visible signals above —
            never the hidden risk.
          </p>
        </>
      ) : (
        <p className="placeholder">Waiting for an episode…</p>
      )}
    </div>
  )
}
