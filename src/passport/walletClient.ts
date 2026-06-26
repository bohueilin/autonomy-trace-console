// Client seam to the Snaplii wallet. All real-money logic lives on the server
// (key + caps + one-shot token + masking). The browser only ever asks our own
// /api/passport/wallet/* routes; it never sees the Snaplii key or raw codes.

export interface WalletStatus {
  connected: boolean
  scope: string
  live: boolean
  brand: { id: string; name: string } | null
  note?: string
}
export interface WalletQuote {
  amount: number
  currency: string
  cashback: number
  brand: string
  approval_token: string
}
export interface WalletReceipt {
  ok: boolean
  simulated: boolean
  amount: number
  brand: string
  masked_code: string
  message: string
}

export async function walletConnect(): Promise<WalletStatus | null> {
  try {
    const r = await fetch('/api/passport/wallet/connect', { method: 'POST' })
    const d = (await r.json()) as WalletStatus & { ok?: boolean }
    return d.ok ? d : null
  } catch {
    return null
  }
}

export async function walletQuote(amount: number, intent: string): Promise<WalletQuote | null> {
  try {
    const r = await fetch('/api/passport/wallet/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount, intent }),
    })
    const d = (await r.json()) as WalletQuote & { ok?: boolean }
    return d.ok && d.approval_token ? d : null
  } catch {
    return null
  }
}

export async function walletPurchase(approval_token: string): Promise<WalletReceipt | null> {
  try {
    const r = await fetch('/api/passport/wallet/purchase', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ approval_token }),
    })
    const d = (await r.json()) as WalletReceipt & { ok?: boolean }
    return d.ok ? d : null
  } catch {
    return null
  }
}
