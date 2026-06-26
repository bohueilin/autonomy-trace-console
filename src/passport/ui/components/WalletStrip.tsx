import { useEffect, useState } from 'react'
import type { PassportSnapshot } from '../../engine/session'
import { walletConnect, walletQuote, walletPurchase } from '../../walletClient'
import type { WalletStatus, WalletQuote, WalletReceipt } from '../../walletClient'
import { Section } from '../bits'
import { money } from '../format'

/**
 * Real Snaplii wallet for any scenario with a payable action (a packet carrying a cost).
 * Connect → live quote → and once YOU approve the packet, the real (or simulated) purchase
 * fires server-side. The browser never holds the key or a raw redemption code.
 */
export function WalletStrip({ snap }: { snap: PassportSnapshot }) {
  const paidPkt = snap.approvals.find((a) => a.estimated_cost)
  const [status, setStatus] = useState<WalletStatus | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [quote, setQuote] = useState<WalletQuote | null>(null)
  const [receipt, setReceipt] = useState<WalletReceipt | null>(null)
  const [paying, setPaying] = useState(false)

  const cost = paidPkt?.estimated_cost ?? null
  const approved = paidPkt ? paidPkt.status === 'approved' || paidPkt.status === 'consumed' : false

  // Quote the payable action once the wallet is connected.
  useEffect(() => {
    if (!status?.connected || !cost || quote) return
    let cancel = false
    void (async () => {
      const q = await walletQuote(cost.amount, snap.scenario.id)
      if (!cancel) setQuote(q)
    })()
    return () => {
      cancel = true
    }
  }, [status?.connected, cost, quote, snap.scenario.id])

  // Pay automatically once YOU approve the packet — your approval is the consent.
  useEffect(() => {
    if (!approved || !quote || receipt || paying) return
    let cancel = false
    void (async () => {
      setPaying(true)
      const r = await walletPurchase(quote.approval_token)
      if (!cancel) {
        setReceipt(r)
        setPaying(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [approved, quote, receipt, paying])

  if (!paidPkt) return null

  const connect = async () => {
    setConnecting(true)
    setStatus(await walletConnect())
    setConnecting(false)
  }

  return (
    <Section
      kicker="Real wallet · Snaplii"
      title="Your money — scoped, capped, and yours to approve"
      aside={status?.connected ? <span className={`pp-wallet-badge ${status.live ? 'pp-wallet-live' : ''}`}>{status.live ? 'LIVE' : 'SIMULATION'}</span> : null}
    >
      {!status?.connected ? (
        <div className="pp-wallet-connect">
          <div className="pp-wallet-pitch">
            <b>Connect Snaplii</b>
            <span>Pay from your prepaid Snaplii Cash — scoped key, daily cap, and your approval on every single buy.</span>
          </div>
          <button className="pp-btn pp-btn-primary" onClick={connect} disabled={connecting}>
            {connecting ? 'Connecting…' : 'Connect wallet'}
          </button>
        </div>
      ) : (
        <div className="pp-wallet">
          <div className="pp-wallet-row">
            <span className="pp-wallet-k">Wallet</span>
            <span>Snaplii Cash · {status.scope}{status.brand ? ` · ${status.brand.name} available` : ''}</span>
          </div>
          {quote && (
            <div className="pp-wallet-row">
              <span className="pp-wallet-k">{quote.brand} credit</span>
              <span>
                <b>{money({ amount: quote.amount, currency: quote.currency })}</b>
                {quote.cashback > 0 && <em className="pp-wallet-cash"> + {money({ amount: quote.cashback, currency: quote.currency })} cashback</em>}
              </span>
            </div>
          )}
          {!approved && quote && !receipt && <div className="pp-wallet-await">Waiting for your approval above to release payment — nothing is charged until you approve.</div>}
          {paying && <div className="pp-wallet-await">Paying with Snaplii…</div>}
          {receipt && (
            <div className={`pp-wallet-receipt ${receipt.simulated ? 'pp-wallet-sim' : ''}`}>
              <b>{receipt.simulated ? '✓ Simulated — no real charge' : '✓ Paid with Snaplii'}</b>
              <span>{receipt.brand} · {money({ amount: receipt.amount, currency: 'USD' })} · code {receipt.masked_code}</span>
              <span className="pp-wallet-msg">{receipt.message}</span>
            </div>
          )}
        </div>
      )}
    </Section>
  )
}
