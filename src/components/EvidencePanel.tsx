import { LICENSE_LEVELS } from '../license'
import type { EvidenceStatus, LicenseLevelId, PersistenceStatus } from '../types'

interface Props {
  /** Live status of the most recent server-episode action. */
  status: PersistenceStatus
  /** Backend snapshot from GET /api/evidence/status (survives client reload). */
  evidence: EvidenceStatus | null
  /** Whether the evidence-status endpoint responded. */
  reached: boolean
}

const STATUS_LABEL: Record<PersistenceStatus, string> = {
  idle: 'Idle — run a server episode',
  saving: 'Saving server trace…',
  saved: 'Trace saved to InsForge',
  local_only: 'Local only — InsForge not configured',
  unavailable: 'InsForge unavailable — server trace returned locally',
}

function licenseColor(id?: string): string | undefined {
  return id && id in LICENSE_LEVELS ? LICENSE_LEVELS[id as LicenseLevelId].color : undefined
}

export function EvidencePanel({ status, evidence, reached }: Props) {
  const configured = evidence?.persistence.configured ?? false
  const table = evidence?.persistence.table ?? 'eval_episodes'
  const summary = evidence?.currentLicenseSummary ?? null

  return (
    <div className="evidence-panel">
      <div className="evidence-head">
        <span className="evidence-title">Evidence store</span>
        <span className={`evidence-dot status-${status}`} aria-hidden="true" />
      </div>

      <div className={`evidence-status status-${status}`}>{STATUS_LABEL[status]}</div>

      <dl className="evidence-grid">
        <dt>Backend</dt>
        <dd>{reached ? 'reached' : <span className="evidence-muted">local-only (unreachable)</span>}</dd>

        <dt>Trace authority</dt>
        <dd>server_authoritative_episode</dd>

        <dt>Storage</dt>
        <dd>
          InsForge · <code>{table}</code>
          {!configured && <span className="evidence-muted"> (unconfigured)</span>}
        </dd>

        <dt>Server episodes</dt>
        <dd>{evidence?.serverEpisodeCount ?? 0}</dd>

        <dt>Run id</dt>
        <dd>{evidence?.runId ? <code>{evidence.runId}</code> : <span className="evidence-muted">—</span>}</dd>

        <dt>Latest trace id</dt>
        <dd>
          {evidence?.latestServerTraceId ? (
            <code>{evidence.latestServerTraceId}</code>
          ) : (
            <span className="evidence-muted">—</span>
          )}
        </dd>

        <dt>Latest record</dt>
        <dd>
          {evidence?.latestPersistedRecordId ? (
            <code>{evidence.latestPersistedRecordId}</code>
          ) : (
            <span className="evidence-muted">—</span>
          )}
        </dd>

        <dt>Server license</dt>
        <dd>
          {summary ? (
            <span style={{ color: licenseColor(summary.level), fontWeight: 700 }}>
              {summary.level} {summary.name}
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
