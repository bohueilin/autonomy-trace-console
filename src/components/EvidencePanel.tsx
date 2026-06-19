import type { PersistenceStatus } from '../types'

interface Props {
  status: PersistenceStatus
  configured: boolean
  table: string
  recordId?: string | null
  runId?: string | null
  recentCount: number
  serverLicense?: { id: string; name: string; color: string } | null
}

const STATUS_LABEL: Record<PersistenceStatus, string> = {
  idle: 'Idle — run a server episode',
  saving: 'Saving server trace…',
  saved: 'Trace saved to InsForge',
  local_only: 'Local only — InsForge not configured',
  unavailable: 'InsForge unavailable — server trace returned locally',
}

export function EvidencePanel({
  status,
  configured,
  table,
  recordId,
  runId,
  recentCount,
  serverLicense,
}: Props) {
  return (
    <div className="evidence-panel">
      <div className="evidence-head">
        <span className="evidence-title">Evidence store</span>
        <span className={`evidence-dot status-${status}`} aria-hidden="true" />
      </div>

      <div className={`evidence-status status-${status}`}>{STATUS_LABEL[status]}</div>

      <dl className="evidence-grid">
        <dt>Trace authority</dt>
        <dd>server_authoritative_episode</dd>

        <dt>Storage</dt>
        <dd>
          InsForge · <code>{table}</code>
          {!configured && <span className="evidence-muted"> (unconfigured)</span>}
        </dd>

        <dt>Latest record</dt>
        <dd>{recordId ? <code>{recordId}</code> : <span className="evidence-muted">—</span>}</dd>

        <dt>Run id</dt>
        <dd>{runId ? <code>{runId}</code> : <span className="evidence-muted">—</span>}</dd>

        <dt>Server episodes</dt>
        <dd>{recentCount}</dd>

        <dt>Server license</dt>
        <dd>
          {serverLicense ? (
            <span style={{ color: serverLicense.color, fontWeight: 700 }}>
              {serverLicense.id} {serverLicense.name}
            </span>
          ) : (
            <span className="evidence-muted">—</span>
          )}
        </dd>
      </dl>

      <p className="evidence-note">
        InsForge preserves evidence. The verifier code remains the source of truth.
      </p>
    </div>
  )
}
