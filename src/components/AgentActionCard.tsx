import type { AgentDecision } from '../types'

interface Props {
  decision: AgentDecision | null
}

export function AgentActionCard({ decision }: Props) {
  return (
    <div className="card action-card">
      <div className="card-head">
        <span className="step-tag">2 · Agent action</span>
        <span className="muted-tag">mocked policy · visible signals only</span>
      </div>

      {decision ? (
        <>
          <div className={`action-badge action-${decision.action}`}>{decision.action}</div>
          <div className="confidence-row">
            <span className="muted">confidence</span>
            <div className="confidence-bar">
              <div className="confidence-fill" style={{ width: `${decision.confidence * 100}%` }} />
            </div>
            <span className="confidence-pct">{Math.round(decision.confidence * 100)}%</span>
          </div>
          <p className="agent-rationale">{decision.rationale}</p>
        </>
      ) : (
        <p className="placeholder">Waiting for an episode…</p>
      )}
    </div>
  )
}
