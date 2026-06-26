import { useEffect, useRef, useState } from 'react'
import { usePassport } from './usePassport'
import type { Speed } from './usePassport'
import { Home } from './components/Home'
import { RunHeader } from './components/RunHeader'
import { PhoneApproval } from './components/PhoneApproval'
import { OrderDetails } from './components/OrderDetails'
import { WalletStrip } from './components/WalletStrip'
import { DiscordShare } from './components/DiscordShare'
import { ResultsSummary } from './components/ResultsSummary'
import type { ExecState } from './components/ResultsSummary'
import { PassportCard } from './components/PassportCard'
import { IntentPanel } from './components/IntentPanel'
import { AgentCollab } from './components/AgentCollab'
import { PlanTimeline } from './components/PlanTimeline'
import { ToolActivityFeed } from './components/ToolActivityFeed'
import { ApprovalCard } from './components/ApprovalCard'
import { ItineraryPanel } from './components/ItineraryPanel'
import { AuditTraceViewer } from './components/AuditTraceViewer'
import { PreventedPanel } from './components/PreventedPanel'
import { Section } from './bits'
import type { SessionStatus } from '../engine/session'
import type { ScenarioSpec } from '../scenarios/types'
import { fetchOrderContext } from '../orderContext'
import type { OrderContext } from '../orderContext'

const STAGES: { key: SessionStatus | 'planning'; label: string }[] = [
  { key: 'planning', label: 'Intent + grant' },
  { key: 'running', label: 'Plan + tools' },
  { key: 'awaiting_approval', label: 'Approval gate' },
  { key: 'completed', label: 'Itinerary + audit' },
]

export function App() {
  const pp = usePassport()
  const snap = pp.snapshot
  const approvalsRef = useRef<HTMLDivElement>(null)
  const reviewApprovals = () => approvalsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  // Real-world execution outcomes (the Snaplii receipt + the Discord send), surfaced in the
  // results summary. Reset on each fresh run so a replay starts clean.
  const [exec, setExec] = useState<ExecState>({})
  const [orderCtx, setOrderCtx] = useState<OrderContext | null>(null)
  useEffect(() => {
    let cancel = false
    void fetchOrderContext().then((c) => {
      if (!cancel) setOrderCtx(c)
    })
    return () => {
      cancel = true
    }
  }, [])
  const startRun = (s: ScenarioSpec) => {
    setExec({})
    pp.start(s)
  }
  const replayRun = () => {
    setExec({})
    pp.replay()
  }

  if (!snap) {
    return (
      <div className="pp-app">
        <TopBar />
        <Home onRun={startRun} />
        <Footer />
      </div>
    )
  }

  const stageIndex =
    snap.status === 'completed' ? 3 : snap.status === 'awaiting_approval' ? 2 : snap.status === 'revoked' ? 3 : 1

  return (
    <div className="pp-app">
      <TopBar
        crumb={snap.scenario.title}
        onBack={pp.reset}
        status={snap.status}
      />

      <div className="pp-controlbar">
        <div className="pp-stages">
          {STAGES.map((s, i) => (
            <div key={s.label} className={`pp-stage ${i <= stageIndex ? 'pp-stage-on' : ''} ${i === stageIndex ? 'pp-stage-cur' : ''}`}>
              <span className="pp-stage-i">{i + 1}</span>
              <span className="pp-stage-l">{s.label}</span>
            </div>
          ))}
        </div>
        <div className="pp-speed" role="group" aria-label="Playback speed">
          {(['live', 'fast', 'instant'] as Speed[]).map((sp) => (
            <button
              key={sp}
              className={`pp-speed-btn ${pp.speed === sp ? 'pp-speed-on' : ''}`}
              onClick={() => pp.setSpeed(sp)}
              aria-pressed={pp.speed === sp}
            >
              {sp === 'live' ? '▶ Live' : sp === 'fast' ? '⏩ Fast' : '⤓ Instant'}
            </button>
          ))}
          <button className="pp-speed-btn pp-replay-btn" onClick={replayRun} title="Replay this scenario">↻ Replay</button>
        </div>
      </div>

      <div className="pp-run">
        <RunHeader snap={snap} onRevoke={pp.revoke} onReview={reviewApprovals} />

        <ResultsSummary snap={snap} exec={exec} ctx={orderCtx} />

        <AgentCollab snap={snap} />

        {snap.approvals.length > 0 && (
          <div ref={approvalsRef}>
            <Section
              kicker="Your approval"
              title="Sensitive actions are prepared — then wait for you"
              aside={<span className="pp-count">{snap.approvals.filter((a) => a.status === 'approved' || a.status === 'consumed').length}/{snap.approvals.length} approved</span>}
            >
              <div className="pp-approvals">
                {snap.approvals.map((p) => (
                  <ApprovalCard
                    key={p.approval_id}
                    packet={p}
                    active={p.approval_id === snap.pendingApprovalId}
                    onApprove={() => pp.approve(p.approval_id)}
                    onDeny={() => pp.deny(p.approval_id)}
                  />
                ))}
              </div>
            </Section>
          </div>
        )}

        <PhoneApproval snap={snap} onApprove={pp.approve} />

        <OrderDetails snap={snap} ctx={orderCtx} />

        <WalletStrip snap={snap} onPaid={(r) => setExec((e) => ({ ...e, wallet: r }))} />

        <DiscordShare snap={snap} ctx={orderCtx} onSent={(r) => setExec((e) => ({ ...e, discord: r }))} />

        <PlanTimeline snap={snap} />
        <ToolActivityFeed snap={snap} />

        {snap.itinerary && <ItineraryPanel itinerary={snap.itinerary} />}

        <details className="pp-report">
          <summary className="pp-report-summary">
            <span>Full report</span>
            <span className="pp-report-hint">grant · intent · what Passport prevented · tamper-evident audit</span>
          </summary>
          <div className="pp-report-body">
            <PassportCard snap={snap} onRevoke={pp.revoke} />
            <IntentPanel snap={snap} />
            <PreventedPanel prevented={snap.prevented} />
            <AuditTraceViewer snap={snap} />
          </div>
        </details>

        <div className="pp-replay">
          <button className="pp-btn pp-btn-ghost" onClick={pp.reset}>← Back to all scenarios</button>
        </div>
      </div>
      <Footer />
    </div>
  )
}

function TopBar({ crumb, onBack, status }: { crumb?: string; onBack?: () => void; status?: SessionStatus }) {
  return (
    <header className="pp-top">
      <div className="pp-top-brand" onClick={onBack} role={onBack ? 'button' : undefined}>
        <span className="pp-top-mark" aria-hidden="true" />
        <span className="pp-top-name">Passport</span>
        <span className="pp-top-sub">delegated autonomy you can trust</span>
      </div>
      {crumb && (
        <nav className="pp-top-nav">
          <button className="pp-top-back" onClick={onBack}>← All scenarios</button>
          <span className="pp-top-crumb">{crumb}</span>
          {status && <span className={`pp-top-status pp-top-status-${status}`}>{statusLabel(status)}</span>}
        </nav>
      )}
    </header>
  )
}

function statusLabel(s: SessionStatus): string {
  switch (s) {
    case 'awaiting_approval':
      return 'Awaiting your approval'
    case 'completed':
      return 'Complete'
    case 'revoked':
      return 'Revoked'
    default:
      return 'Running'
  }
}

function Footer() {
  return (
    <footer className="pp-foot">
      <span>Passport · local demo</span>
      <span className="pp-foot-mid">Capability is not permission. The agent can propose; Passport decides what it may do.</span>
      <span>No real actions · credentials stay brokered, scoped, revocable</span>
    </footer>
  )
}
