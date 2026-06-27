import { useState } from 'react'
import type { PassportSnapshot } from '../../engine/session'
import type { Capability } from '../../types'
import type { OrderContext } from '../../orderContext'
import type { WalletReceipt } from '../../walletClient'
import type { DiscordSendResult } from '../../discordClient'
import { sendJourneySummary } from '../../emailClient'
import type { EmailResult } from '../../emailClient'

export interface ExecState {
  wallet?: WalletReceipt
  discord?: DiscordSendResult
}

interface ResultRow {
  icon: string
  head: string
  detail: string
}

function approved(snap: PassportSnapshot, cap: Capability): boolean {
  return snap.approvals.some((p) => p.capability === cap && (p.status === 'approved' || p.status === 'consumed'))
}

/**
 * The execution-results moment: once the run completes, Passport reports back exactly what it
 * did — only the actions you approved, each with its concrete outcome. Closes the loop:
 * request → understand → act (with a granted Passport) → results. You can email yourself the recap.
 */
export function ResultsSummary({ snap, exec, ctx }: { snap: PassportSnapshot; exec: ExecState; ctx: OrderContext | null }) {
  const [emailing, setEmailing] = useState(false)
  const [emailRes, setEmailRes] = useState<EmailResult | null>(null)

  if (snap.status !== 'completed') return null

  const rows: ResultRow[] = []

  if (approved(snap, 'delivery.order.submit')) {
    const w = exec.wallet
    const place = ctx?.deliveryAddress ?? 'your home'
    const eta = ctx?.orderEta ?? '7:00 PM'
    const vendor = ctx?.orderVendor ?? 'La Taqueria · DoorDash'
    const pay = w
      ? ` Paid $${w.amount.toFixed(2)} via Snaplii · code ${w.masked_code}${w.simulated ? ' (simulated — no real charge)' : ''}.`
      : ''
    rows.push({ icon: '🌯', head: 'DoorDash order placed', detail: `${vendor} — ETA ${eta} at ${place}.${pay}` })
  }
  if (approved(snap, 'social.post.commit')) {
    const d = exec.discord
    const detail = d
      ? d.simulated
        ? `Message ready for #game-night (simulated — set a webhook to post for real).`
        : d.ok
          ? 'Posted to your Discord — your homies can join you.'
          : 'Tried to post — Discord did not accept it.'
      : 'Shared the plan to Discord · Game Night.'
    rows.push({ icon: '🎮', head: 'Game Night invited', detail })
  }
  if (approved(snap, 'calendar.write.commit')) {
    rows.push({ icon: '🗓', head: 'Calendar blocked', detail: `FIFA catch-up night · ${ctx?.gamePlan ?? 'this week'}.` })
  }
  if (approved(snap, 'reminders.write.commit')) {
    rows.push({ icon: '⏰', head: 'Reminders set', detail: 'Start on time, and stay spoiler-free until then.' })
  }

  const nothing = rows.length === 0

  const emailMe = () => {
    setEmailing(true)
    void sendJourneySummary({
      scenario: snap.scenario.title,
      request: snap.intent.raw_user_request,
      results: rows.map((r) => ({ head: r.head, detail: r.detail })),
    }).then((r) => {
      setEmailRes(r)
      setEmailing(false)
    })
  }

  return (
    <section className="pp-results">
      <div className="pp-results-head">
        <span className="pp-results-mark" aria-hidden="true">
          ✓
        </span>
        <div>
          <div className="pp-results-kicker">Done · execution results</div>
          <h2 className="pp-results-title">{nothing ? 'Nothing was executed — and that’s fine' : 'Here’s what I did'}</h2>
        </div>
      </div>

      {nothing ? (
        <p className="pp-results-empty">
          You held everything back — no order, no message, nothing irreversible. The full plan is ready whenever you want it.
        </p>
      ) : (
        <div className="pp-results-rows">
          {rows.map((r) => (
            <div key={r.head} className="pp-results-row">
              <span className="pp-results-icon" aria-hidden="true">
                {r.icon}
              </span>
              <div className="pp-results-tx">
                <b>{r.head}</b>
                <span>{r.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!nothing && (
        <div className="pp-results-actions">
          {!emailRes ? (
            <button className="pp-btn pp-btn-ghost" onClick={emailMe} disabled={emailing}>
              {emailing ? 'Sending…' : '✉ Email me this summary'}
            </button>
          ) : emailRes.sent ? (
            <span className="pp-results-email pp-results-email-ok">✓ Sent to {emailRes.to}</span>
          ) : emailRes.error ? (
            <span className="pp-results-email pp-results-email-err">⚠ {emailRes.error}</span>
          ) : (
            <span className="pp-results-email pp-results-email-sim">
              Summary ready — set <code>RESEND_API_KEY</code> + <code>SUMMARY_EMAIL</code> to send to {emailRes.to}
            </span>
          )}
        </div>
      )}

      <p className="pp-results-foot">Every real-world action ran only after you approved it — on your phone or here.</p>
    </section>
  )
}
