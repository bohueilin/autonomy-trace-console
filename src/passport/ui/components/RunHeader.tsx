import type { PassportSnapshot } from '../../engine/session'
import { getScenario } from '../../scenarios'
import { money } from '../format'

const STATUS_LABEL: Record<string, string> = {
  running: 'Working…',
  awaiting_approval: 'Waiting for you',
  completed: 'Done',
  revoked: 'Stopped',
}

/**
 * The human-first run header (Luma-clean): your request, the tools Passport granted,
 * overall progress, and a phone-style approval callout. The technical grant/intent/audit
 * detail lives lower, in the "Full report" disclosure.
 */
export function RunHeader({
  snap,
  onReview,
  onRevoke,
}: {
  snap: PassportSnapshot
  onReview?: () => void
  onRevoke?: () => void
}) {
  const scenario = getScenario(snap.scenario.id)
  const tools = scenario?.tools ?? []
  const total = snap.plan.steps.length
  const done = snap.plan.steps.filter((s) => s.status === 'done').length
  const pct = Math.round((done / Math.max(1, total)) * 100)
  const awaiting = snap.status === 'awaiting_approval'
  const pending = snap.approvals.find((a) => a.approval_id === snap.pendingApprovalId)
  const live = snap.status === 'running' || snap.status === 'awaiting_approval'

  return (
    <section className="pp-runhead">
      <div className="pp-runhead-top">
        <div className="pp-runhead-req">
          <span className="pp-mini-label">Your request</span>
          <p className="pp-runhead-prompt">{snap.intent.raw_user_request}</p>
        </div>
        <div className="pp-runhead-meta">
          <span className={`pp-runhead-status pp-runhead-status-${snap.status}`}>{STATUS_LABEL[snap.status] ?? 'Working…'}</span>
          {live && onRevoke && (
            <button className="pp-runhead-revoke" onClick={onRevoke} title="Kill switch — stop the agent now">⊘ Revoke</button>
          )}
        </div>
      </div>

      {tools.length > 0 && (
        <div className="pp-runhead-tools">
          <span className="pp-mini-label">Tools Passport gave the agent — only these, only for this task</span>
          <div className="pp-tool-row">
            {tools.map((t) => (
              <span key={t.name} className={`pp-tool ${t.approval ? 'pp-tool-approval' : ''}`}>
                <b>{t.name}</b>
                <span>{t.use}</span>
                {t.approval && <em className="pp-tool-badge">needs your ok</em>}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="pp-runhead-progress">
        <div className="pp-progress" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
        <span className="pp-runhead-pct">{done} of {total} steps</span>
      </div>

      {awaiting && pending && (
        <button className="pp-phone" onClick={onReview}>
          <span className="pp-phone-icon" aria-hidden="true">📱</span>
          <span className="pp-phone-tx">
            <b>Approval request sent to your phone</b>
            <span>
              {pending.action_type}
              {pending.estimated_cost ? ` · ${money(pending.estimated_cost)}` : ''} — tap to review
            </span>
          </span>
          <span className="pp-phone-cta">Review ↓</span>
        </button>
      )}
    </section>
  )
}
