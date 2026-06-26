// ----------------------------------------------------------------------------
// Snaplii real-payment broker — runs ONLY in the Node server. The SNAPLII_API_KEY
// (snp_sk_live_…) lives here and is never sent to the browser. Mirrors Passport's
// own thesis: Snaplii alone allows within-cap auto-spend; Passport overrides that
// to require a per-action, one-shot, amount-bound, HMAC-signed human approval.
//
// Safety rails (defense in depth):
//   • key server-side only; redemption codes/PINs masked, never logged
//   • a purchase requires a one-shot HMAC approval token bound to {amount,item,intent}
//   • server-enforced per-buy + per-process spend caps on top of Snaplii's own daily cap
//   • LIVE money only when SNAPLII_LIVE=1; otherwise an approved buy is SIMULATED
// ----------------------------------------------------------------------------

import crypto from 'node:crypto'
import type { SnapliiConfig } from './config.ts'

const DEFAULT_TIMEOUT = 15000
const TOKEN_TTL_MS = 10 * 60 * 1000 // an approval token is valid 10 minutes
const consumedNonces = new Set<string>() // one-shot: a token can be spent once
let approvedSpendUsd = 0 // per-process running total (cap backstop)

// ---- session token cache (Snaplii JWT from the snp_sk_live_ key) ----
let cachedJwt: { token: string; exp: number } | null = null

async function snapliiToken(cfg: SnapliiConfig): Promise<string | null> {
  if (!cfg.apiKey) return null
  if (cachedJwt && cachedJwt.exp > Date.now() + 30000) return cachedJwt.token
  try {
    const resp = await timedFetch(`${cfg.baseUrl}/v2/auth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agent_id: 'passport-origin', api_key: cfg.apiKey }),
    })
    if (!resp.ok) {
      console.error(`[snaplii] auth ${resp.status}`)
      return null
    }
    const data = (await resp.json()) as { token?: string; access_token?: string; jwt?: string }
    const token = data.token ?? data.access_token ?? data.jwt
    if (!token) return null
    cachedJwt = { token, exp: Date.now() + 50 * 60 * 1000 }
    return token
  } catch (err) {
    console.error('[snaplii] auth failed:', (err as Error)?.name ?? 'error')
    return null
  }
}

function timedFetch(url: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

// ---- HMAC approval token (binds an approved purchase to its exact amount/item) ----
function b64url(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64url')
}
function sign(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('base64url')
}
interface ApprovalClaim {
  kind: 'snaplii_purchase'
  amount: number
  currency: string
  item: string
  intent: string
  nonce: string
  exp: number
}
function mintToken(secret: string, claim: ApprovalClaim): string {
  const body = b64url(JSON.stringify(claim))
  return `${body}.${sign(secret, body)}`
}
function verifyToken(secret: string, token: string): ApprovalClaim | null {
  const dot = token.lastIndexOf('.')
  if (dot < 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(secret, body)
  // constant-time compare
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  let claim: ApprovalClaim
  try {
    claim = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ApprovalClaim
  } catch {
    return null
  }
  if (claim.kind !== 'snaplii_purchase' || typeof claim.exp !== 'number' || claim.exp < Date.now()) return null
  return claim
}

// ---- masking: never return raw redemption codes/PINs ----
function mask(v: unknown): string {
  const s = String(v ?? '')
  if (s.length <= 4) return '••••'
  return `${'•'.repeat(Math.max(4, s.length - 4))}${s.slice(-4)}`
}

// ====================================================================
// 1) CONNECT — verify the key works; report scope + the DoorDash brand. Read-only.
// ====================================================================
export interface WalletConnectResult {
  ok: boolean
  connected: boolean
  scope: string
  live: boolean
  brand: { id: string; name: string } | null
  note?: string
  error?: string
}

let cachedDoorDashBrand: { id: string; name: string } | null = null

async function findDoorDashBrand(cfg: SnapliiConfig, token: string): Promise<{ id: string; name: string } | null> {
  if (cachedDoorDashBrand) return cachedDoorDashBrand
  try {
    const resp = await timedFetch(`${cfg.baseUrl}/v2/card-brands`, {
      headers: { authorization: `Bearer ${token}` },
    })
    if (!resp.ok) return null
    const data = (await resp.json()) as unknown
    // The catalog is an array of categories, each with a nested `cardBrands` array.
    const cats = (Array.isArray(data) ? data : ((data as Record<string, unknown>)?.data ?? [])) as Record<string, unknown>[]
    const brands: Record<string, unknown>[] = []
    for (const c of cats) {
      for (const b of ((c.cardBrands ?? []) as Record<string, unknown>[])) brands.push(b)
    }
    const dd = brands.find((b) => /door\s?dash/i.test(String(b.name ?? b.brandName ?? b.alternativeName ?? '')))
    if (!dd) return null
    const id = String(dd.cardBrandId ?? dd.id ?? dd.brandId ?? dd.itemId ?? '')
    const name = String(dd.name ?? 'DoorDash')
    if (!id) return null
    cachedDoorDashBrand = { id, name }
    return cachedDoorDashBrand
  } catch {
    return null
  }
}

export async function connectWallet(cfg: SnapliiConfig, live: boolean): Promise<WalletConnectResult> {
  if (!cfg.apiKey) {
    return { ok: false, connected: false, scope: 'none', live, brand: null, error: 'Snaplii is not configured on the server.' }
  }
  const token = await snapliiToken(cfg)
  if (!token) {
    return { ok: false, connected: false, scope: 'unknown', live, brand: null, error: 'Could not connect to Snaplii (auth failed).' }
  }
  const brand = await findDoorDashBrand(cfg, token)
  return {
    ok: true,
    connected: true,
    scope: 'PAY_WRITE',
    live,
    brand,
    note: live ? 'Live purchases enabled — approved buys spend real Snaplii Cash.' : 'Simulation mode — approved buys are simulated (set SNAPLII_LIVE=1 for real spend).',
  }
}

// ====================================================================
// 2) QUOTE — real price preview + a one-shot approval token. Read-only (no charge).
// ====================================================================
export interface WalletQuoteResult {
  ok: boolean
  amount: number
  currency: string
  cashback: number
  brand: string
  approval_token?: string
  error?: string
  code?: 'no_key' | 'over_cap' | 'upstream' | 'bad_request'
}

export async function quoteOrder(
  body: unknown,
  cfg: SnapliiConfig,
  episodeSecret: string,
): Promise<WalletQuoteResult> {
  const b = (body ?? {}) as Record<string, unknown>
  const amount = Number(b.amount)
  const intent = String(b.intent ?? 'enrich-my-life').slice(0, 64)
  const currency = 'USD'
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, amount: 0, currency, cashback: 0, brand: 'DoorDash', code: 'bad_request', error: 'Invalid amount.' }
  }
  if (amount > cfg.perBuyCapUsd) {
    return { ok: false, amount, currency, cashback: 0, brand: 'DoorDash', code: 'over_cap', error: `Over the per-purchase cap of $${cfg.perBuyCapUsd}.` }
  }
  const token = await snapliiToken(cfg)
  if (!token) {
    return { ok: false, amount, currency, cashback: 0, brand: 'DoorDash', code: 'no_key', error: 'Snaplii not connected.' }
  }
  const brand = (await findDoorDashBrand(cfg, token)) ?? { id: '', name: 'DoorDash' }

  let cashback = Math.round(amount * 0.04 * 100) / 100 // shown as estimate; refined by real quote when available
  try {
    const resp = await timedFetch(`${cfg.baseUrl}/v2/quote`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        orderInfo: { orderType: 'GIFT_CARD', item: { itemId: brand.id, price: String(amount) } },
        paymentContext: { specifiedPrimaryPaymentMethod: 'SNAPLII_CREDIT', voucherOption: 'BEST_FIT', cashbackOption: 'USE' },
      }),
    })
    if (resp.ok) {
      const data = (await resp.json()) as Record<string, unknown>
      const cb = Number(data.cashback ?? (data.paymentContext as Record<string, unknown> | undefined)?.cashback)
      if (Number.isFinite(cb) && cb >= 0) cashback = Math.round(cb * 100) / 100
    } else {
      console.error(`[snaplii] quote ${resp.status}`)
    }
  } catch {
    /* keep estimate */
  }

  const nonce = crypto.randomUUID()
  const approval_token = mintToken(episodeSecret, {
    kind: 'snaplii_purchase',
    amount,
    currency,
    item: brand.id || 'doordash',
    intent,
    nonce,
    exp: Date.now() + TOKEN_TTL_MS,
  })
  return { ok: true, amount, currency, cashback, brand: brand.name, approval_token }
}

// ====================================================================
// 3) PURCHASE — fires ONLY with a valid one-shot approval token + within caps.
//    Real money only when SNAPLII_LIVE=1; otherwise simulated.
// ====================================================================
export interface WalletPurchaseResult {
  ok: boolean
  simulated: boolean
  amount: number
  currency: string
  brand: string
  masked_code: string
  message: string
  error?: string
  code?: 'no_token' | 'bad_token' | 'replayed' | 'over_cap' | 'no_key' | 'upstream'
}

export async function purchaseOrder(
  body: unknown,
  cfg: SnapliiConfig,
  episodeSecret: string,
  live: boolean,
): Promise<WalletPurchaseResult> {
  const b = (body ?? {}) as Record<string, unknown>
  const token = typeof b.approval_token === 'string' ? b.approval_token : ''
  const fail = (code: WalletPurchaseResult['code'], error: string): WalletPurchaseResult => ({
    ok: false, simulated: false, amount: 0, currency: 'USD', brand: 'DoorDash', masked_code: '', message: '', code, error,
  })

  if (!token) return fail('no_token', 'Purchase requires an approval token (approve first).')
  const claim = verifyToken(episodeSecret, token)
  if (!claim) return fail('bad_token', 'Approval token is invalid or expired.')
  if (consumedNonces.has(claim.nonce)) return fail('replayed', 'This approval was already used (one-shot).')
  if (claim.amount > cfg.perBuyCapUsd) return fail('over_cap', `Over the per-purchase cap of $${cfg.perBuyCapUsd}.`)
  if (approvedSpendUsd + claim.amount > cfg.dailyCapUsd) return fail('over_cap', `Over the session spend cap of $${cfg.dailyCapUsd}.`)

  // Consume the one-shot token BEFORE side-effecting so a retry can't double-charge.
  consumedNonces.add(claim.nonce)

  if (!live) {
    approvedSpendUsd += claim.amount
    return {
      ok: true, simulated: true, amount: claim.amount, currency: claim.currency, brand: 'DoorDash',
      masked_code: mask(`SIM-${claim.nonce}`),
      message: `Simulated: a $${claim.amount} DoorDash credit would be purchased via Snaplii. Set SNAPLII_LIVE=1 for a real buy.`,
    }
  }

  // LIVE: real Snaplii purchase.
  const sessionToken = await snapliiToken(cfg)
  if (!sessionToken) {
    consumedNonces.delete(claim.nonce) // allow retry — nothing was charged
    return fail('no_key', 'Snaplii not connected.')
  }
  try {
    const resp = await timedFetch(`${cfg.baseUrl}/v2/purchase`, {
      method: 'POST',
      headers: { authorization: `Bearer ${sessionToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        orderInfo: { orderType: 'GIFT_CARD', item: { itemId: claim.item, price: String(claim.amount) } },
        paymentContext: { specifiedPrimaryPaymentMethod: 'SNAPLII_CREDIT', voucherOption: 'BEST_FIT', cashbackOption: 'USE' },
        delivery: { type: 'WALLET', immediateSend: 'true' },
      }),
    })
    if (!resp.ok) {
      consumedNonces.delete(claim.nonce) // nothing charged on a failed call
      console.error(`[snaplii] purchase ${resp.status}`)
      return fail('upstream', 'Snaplii could not complete the purchase.')
    }
    const data = (await resp.json()) as Record<string, unknown>
    approvedSpendUsd += claim.amount
    const rawCode = data.redemptionCode ?? data.code ?? (data.card as Record<string, unknown> | undefined)?.code ?? claim.nonce
    return {
      ok: true, simulated: false, amount: claim.amount, currency: claim.currency, brand: 'DoorDash',
      masked_code: mask(rawCode), // never the raw code
      message: `Purchased $${claim.amount} DoorDash credit via Snaplii Cash. Redemption code stored in your Snaplii wallet.`,
    }
  } catch (err) {
    consumedNonces.delete(claim.nonce)
    console.error('[snaplii] purchase failed:', (err as Error)?.name ?? 'error')
    return fail('upstream', 'Could not reach Snaplii.')
  }
}
