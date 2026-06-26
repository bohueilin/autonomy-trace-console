import { useEffect, useRef, useState } from 'react'
import type { PassportSnapshot } from '../../engine/session'
import { requestPhoneApproval, pollPhoneStatus } from '../../notifyClient'
import type { PhoneApprovalHandle } from '../../notifyClient'
import { Section } from '../bits'
import { money } from '../format'

/**
 * Sends a REAL push/SMS to your phone for the pending sensitive action (anything irreversible
 * or carrying a cost), then mirrors a phone tap back into the run. You can equally approve in
 * the panel above — whichever happens first wins. One notification per distinct packet.
 *
 * `handle` and `tapped` are derived against the active packet id so a new packet starts fresh
 * with no setState-in-effect resets.
 */
export function PhoneApproval({ snap, onApprove }: { snap: PassportSnapshot; onApprove: (approvalId: string) => void }) {
  const pending = snap.approvals.find((a) => a.approval_id === snap.pendingApprovalId && a.status === 'pending')
  const sensitive = pending ? pending.irreversible || Boolean(pending.estimated_cost) : false
  const activeId = sensitive && pending ? pending.approval_id : null

  const [handleState, setHandleState] = useState<{ id: string; handle: PhoneApprovalHandle | null } | null>(null)
  const [tappedId, setTappedId] = useState<string | null>(null)
  const sentForRef = useRef<string | null>(null)

  // Derived against the current packet — stale state for a previous packet reads as absent.
  const handle = handleState && handleState.id === activeId ? handleState.handle : null
  const tapped = tappedId !== null && tappedId === activeId

  // Send exactly one notification when a new sensitive packet becomes pending.
  useEffect(() => {
    if (!activeId || !pending) return
    if (sentForRef.current === activeId) return
    sentForRef.current = activeId
    let cancel = false
    void (async () => {
      const h = await requestPhoneApproval({
        title: pending.action_type,
        summary: pending.description,
        amount: pending.estimated_cost?.amount ?? null,
      })
      if (!cancel) setHandleState({ id: activeId, handle: h })
    })()
    return () => {
      cancel = true
    }
  }, [activeId, pending])

  // Poll for a phone tap; on approval, advance this exact packet once.
  useEffect(() => {
    if (!handle || !activeId || tapped || !handle.approvableFromPhone) return
    let cancel = false
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      const s = await pollPhoneStatus(handle.id)
      if (cancel) return
      if (s === 'approved') {
        setTappedId(activeId)
        onApprove(activeId)
        return
      }
      if (s === 'expired') return // stop polling; in-app approval still works
      timer = setTimeout(tick, 1600)
    }
    timer = setTimeout(tick, 1600)
    return () => {
      cancel = true
      clearTimeout(timer)
    }
  }, [handle, activeId, tapped, onApprove])

  if (!sensitive || !pending) return null

  const cost = pending.estimated_cost
  const sim = handle?.channel === 'simulation'
  const channelLabel =
    handle?.channel === 'push+sms' ? 'Push + SMS' : handle?.channel === 'push' ? 'Push' : handle?.channel === 'sms' ? 'SMS' : 'Simulation'

  return (
    <Section
      kicker="Approve from your phone"
      title="A request just went to your phone"
      aside={<span className={`pp-ph-badge ${sim ? 'pp-ph-badge-sim' : ''}`}>{channelLabel}</span>}
    >
      <div className="pp-ph">
        <div className="pp-ph-device" aria-hidden="true">
          <div className="pp-ph-notch" />
          <div className="pp-ph-card">
            <div className="pp-ph-app">
              <span className="pp-ph-dot" />
              Passport
            </div>
            <b className="pp-ph-title">
              {pending.action_type}
              {cost ? ` · ${money(cost)}` : ''}
            </b>
            <span className="pp-ph-body">{pending.description}</span>
            <div className="pp-ph-actions">
              <span className="pp-ph-approve">{tapped ? 'Approved ✓' : 'Approve'}</span>
              <span className="pp-ph-deny">Deny</span>
            </div>
          </div>
        </div>
        <div className="pp-ph-side">
          {!handle ? (
            <p className="pp-ph-status">Sending the request to your phone…</p>
          ) : tapped ? (
            <p className="pp-ph-status pp-ph-ok">✓ Approved on your phone — continuing now.</p>
          ) : sim ? (
            <>
              <p className="pp-ph-status pp-ph-sim">
                Simulation — set <code>NTFY_TOPIC</code> (free push) or <code>TWILIO_*</code> to ring{' '}
                <b>{handle.target}</b> for real.
              </p>
              <p className="pp-ph-hint">Use the buttons in “Your approval” above to approve here.</p>
            </>
          ) : (
            <>
              <p className="pp-ph-status">
                {channelLabel} sent to <b>{handle.target}</b>
                {handle.approvableFromPhone ? ' — tap Approve on your phone.' : '.'}
              </p>
              <p className="pp-ph-hint">
                {handle.approvableFromPhone
                  ? 'Waiting for your tap… or approve here in the panel above.'
                  : 'Set PUBLIC_BASE_URL so the phone’s Approve button can reach back — for now, approve here.'}
              </p>
            </>
          )}
        </div>
      </div>
    </Section>
  )
}
