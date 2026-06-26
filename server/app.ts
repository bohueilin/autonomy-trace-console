// ----------------------------------------------------------------------------
// Hono app construction — the routes, with no listener side effects.
//
// `createApp(config)` builds the route table so it can be imported and exercised
// with `app.request(...)` in tests without binding a port. `server/main.ts` stays
// a thin entrypoint that loads config and serves this app.
//
// Exposes:
//   GET  /health
//   Gym (RL env, external policy):
//     POST /v1/episodes                      reset -> { episodeId, observation }
//     POST /v1/episodes/:episodeId/step      step  -> { reward, done, info, license }
//     POST /v1/step                          step  (episodeId in body)
//   Gym (server-owned reference agents):
//     POST /v1/reference-episodes            run one mock/nebius reference episode
//   Legacy (current UI + reference flows), reusing existing handlers:
//     POST /api/run-episode, GET /api/runs/recent, GET /api/evidence/status,
//     POST /api/nebius-action, POST /api/vapi/tools
// ----------------------------------------------------------------------------

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { AppConfig } from './config.ts'
import { resetEpisode, stepEpisode, type GymConfig } from './env/gym.ts'
import { ENVIRONMENT_NAME } from './evalVersions.ts'
import type { NebiusErrorCode } from './nebiusHandler.ts'
import { handleNebiusAction } from './nebiusHandler.ts'
import { classifyIntent } from './passportIntentHandler.ts'
import { connectWallet, quoteOrder, authorizeOrder, purchaseOrder } from './snapliiHandler.ts'
import { approvalStatus, phoneApprove, requestApproval } from './notifyHandler.ts'
import { sendDiscord } from './discordHandler.ts'
import { runReferenceEpisode } from './referenceAgent.ts'
import { getEvidenceStatus, getRecentRuns, handleRunEpisode } from './runEpisodeHandler.ts'
import { handleVapiTools } from './vapiHandler.ts'

function nebiusStatus(code: NebiusErrorCode): ContentfulStatusCode {
  switch (code) {
    case 'bad_request':
      return 400
    case 'no_key':
      return 503
    case 'timeout':
      return 504
    default:
      return 502
  }
}

async function jsonBody(c: { req: { json: () => Promise<unknown> } }): Promise<Record<string, unknown>> {
  try {
    const b = await c.req.json()
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

// Strict body parser for `/v1` routes: a malformed, non-object, or array body must
// be rejected (not silently coerced to `{}`), so a trusted episode can never be
// minted from a request the server could not actually understand.
type StrictBody =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string }

async function strictJsonObject(c: { req: { json: () => Promise<unknown> } }): Promise<StrictBody> {
  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    return { ok: false, error: 'Request body must be valid JSON.' }
  }
  if (Array.isArray(raw)) {
    return { ok: false, error: 'Request body must be a JSON object, not an array.' }
  }
  if (raw === null || typeof raw !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object.' }
  }
  return { ok: true, body: raw as Record<string, unknown> }
}

const badRequest = (
  c: { json: (v: unknown, s: ContentfulStatusCode) => Response },
  error: string,
): Response => c.json({ ok: false, code: 'bad_request', error }, 400)

/** Keys present in `body` that are not in the allow-list. */
function extraKeys(body: Record<string, unknown>, allowed: string[]): string[] {
  return Object.keys(body).filter((k) => !allowed.includes(k))
}

const stepStatus = (r: { ok: boolean; code?: string }): ContentfulStatusCode =>
  r.ok ? 200 : r.code === 'bad_request' ? 400 : 502

// Lightweight in-process throttle for the outbound-channel routes (defense vs a local script
// hammering ntfy / Twilio / Discord and burning their quotas). Per-key fixed window — generous
// enough for live demos + replays, tight enough to stop a spam loop.
const channelHits = new Map<string, { n: number; resetAt: number }>()
function channelThrottled(key: string, maxPerMin: number): boolean {
  const now = Date.now()
  const e = channelHits.get(key)
  if (!e || now >= e.resetAt) {
    channelHits.set(key, { n: 1, resetAt: now + 60_000 })
    return false
  }
  if (e.n >= maxPerMin) return true
  e.n++
  return false
}

export function createApp(config: AppConfig): Hono {
  const runCfg = { nebius: config.nebius, insforge: config.insforge }
  const gymCfg: GymConfig = { insforge: config.insforge, episodeSecret: config.episodeSecret }

  const app = new Hono()
  app.use('*', cors())

  app.get('/health', (c) =>
    c.json({ ok: true, environment: ENVIRONMENT_NAME, time: new Date().toISOString() }),
  )

  // ---- Gym env (external policy) -----------------------------------------
  // PUBLIC reset for external agents. `scenarioId` may be omitted (random external
  // scenario), but a PRESENT field must be the right type — a mistyped or blank
  // value is a client error, never silently coerced.
  app.post('/v1/episodes', async (c) => {
    const parsed = await strictJsonObject(c)
    if (!parsed.ok) return badRequest(c, parsed.error)
    const body = parsed.body
    if ('scenarioId' in body && (typeof body.scenarioId !== 'string' || body.scenarioId.trim() === '')) {
      return badRequest(c, 'scenarioId must be a non-empty string when provided.')
    }
    if ('agentId' in body && typeof body.agentId !== 'string') {
      return badRequest(c, 'agentId must be a string when provided.')
    }
    const r = resetEpisode(
      { scenarioId: body.scenarioId as string | undefined, agentId: body.agentId as string | undefined },
      gymCfg,
    )
    return c.json(r, r.ok ? 200 : 400)
  })

  // The step body is server-enforced as EXACTLY { action } — any extra key
  // (confidence, rationale, reward, license, passed, episodeId, …) is rejected so
  // a client can never write a digest-covered field through `/v1`.
  app.post('/v1/episodes/:episodeId/step', async (c) => {
    const parsed = await strictJsonObject(c)
    if (!parsed.ok) return badRequest(c, parsed.error)
    const body = parsed.body
    const extra = extraKeys(body, ['action'])
    if (extra.length) {
      return badRequest(c, `Unexpected field(s): ${extra.join(', ')}. Send only { action }.`)
    }
    if (typeof body.action !== 'string' || body.action.trim() === '') {
      return badRequest(c, 'action must be a non-empty string.')
    }
    const r = await stepEpisode({ episodeId: c.req.param('episodeId'), action: body.action }, gymCfg)
    return c.json(r, stepStatus(r))
  })

  // The body-form step is enforced as EXACTLY { episodeId, action }.
  app.post('/v1/step', async (c) => {
    const parsed = await strictJsonObject(c)
    if (!parsed.ok) return badRequest(c, parsed.error)
    const body = parsed.body
    const extra = extraKeys(body, ['episodeId', 'action'])
    if (extra.length) {
      return badRequest(c, `Unexpected field(s): ${extra.join(', ')}. Send only { episodeId, action }.`)
    }
    if (typeof body.episodeId !== 'string' || body.episodeId.trim() === '') {
      return badRequest(c, 'episodeId must be a non-empty string.')
    }
    if (typeof body.action !== 'string' || body.action.trim() === '') {
      return badRequest(c, 'action must be a non-empty string.')
    }
    const r = await stepEpisode({ episodeId: body.episodeId, action: body.action }, gymCfg)
    return c.json(r, stepStatus(r))
  })

  // ---- Gym env (server-owned reference agents) ---------------------------
  // The ONLY path that can mint trusted mock/nebius provenance — and only after
  // the server actually runs that reference agent against the gym env.
  app.post('/v1/reference-episodes', async (c) => {
    const parsed = await strictJsonObject(c)
    if (!parsed.ok) return badRequest(c, parsed.error)
    const body = parsed.body
    const extra = extraKeys(body, ['scenarioId', 'mode'])
    if (extra.length) {
      return badRequest(c, `Unexpected field(s): ${extra.join(', ')}. Send only { scenarioId, mode }.`)
    }
    if (typeof body.scenarioId !== 'string' || body.scenarioId.trim() === '') {
      return badRequest(c, 'scenarioId must be a non-empty string.')
    }
    if (body.mode !== 'mock' && body.mode !== 'nebius') {
      return badRequest(c, 'mode must be "mock" or "nebius".')
    }
    const r = await runReferenceEpisode(
      { scenarioId: body.scenarioId, mode: body.mode },
      { gym: gymCfg, nebius: config.nebius },
    )
    return c.json(r, r.ok ? 200 : r.code === 'bad_request' ? 400 : 502)
  })

  // ---- Legacy /api (reuses existing server-owned handlers) ----------------
  app.post('/api/run-episode', async (c) => {
    const r = await handleRunEpisode(await jsonBody(c), runCfg)
    if (!r.ok) return c.json(r, r.code === 'bad_request' ? 400 : 502)
    // Client-safe subset (auditRow stays server-side).
    return c.json({ ok: true, trace: r.trace, license: r.license, persistence: r.persistence, runId: r.runId })
  })
  app.get('/api/runs/recent', (c) => c.json({ ok: true, runs: getRecentRuns(10) }))
  app.get('/api/evidence/status', async (c) => {
    const limitRaw = Number(c.req.query('limit'))
    const status = await getEvidenceStatus(runCfg, {
      refresh: c.req.query('refresh') === '1',
      limit: Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined,
      runId: c.req.query('run_id') ?? undefined,
    })
    return c.json({ ok: true, ...status })
  })
  app.post('/api/nebius-action', async (c) => {
    const r = await handleNebiusAction(await jsonBody(c), config.nebius)
    return c.json(r, r.ok ? 200 : nebiusStatus(r.code))
  })
  app.post('/api/vapi/tools', async (c) => c.json(await handleVapiTools(await jsonBody(c), runCfg)))

  // Passport brain — GMI Cloud intent understanding (voice/text → scenario).
  app.post('/api/passport/intent', async (c) => {
    const r = await classifyIntent(await jsonBody(c), config.gmi)
    const status: ContentfulStatusCode = r.ok
      ? 200
      : r.code === 'bad_request' ? 400 : r.code === 'no_key' ? 503 : r.code === 'timeout' ? 504 : 502
    return c.json(r, status)
  })

  // Snaplii wallet — real, scoped payments (key server-side only). Local-only:
  // reject any cross-origin browser caller (defense vs CSRF on the money routes).
  const walletOriginOk = (origin: string | undefined): boolean => {
    if (!origin) return true // same-origin / non-browser (the Vite proxy is same-origin)
    try {
      const h = new URL(origin).hostname
      return h === 'localhost' || h === '127.0.0.1'
    } catch {
      return false
    }
  }
  app.post('/api/passport/wallet/connect', async (c) => {
    if (!walletOriginOk(c.req.header('origin'))) return c.json({ ok: false, error: 'forbidden' }, 403)
    const r = await connectWallet(config.snaplii, config.snaplii.live)
    return c.json(r, r.ok ? 200 : 503)
  })
  app.post('/api/passport/wallet/quote', async (c) => {
    if (!walletOriginOk(c.req.header('origin'))) return c.json({ ok: false, error: 'forbidden' }, 403)
    const r = await quoteOrder(await jsonBody(c), config.snaplii, config.episodeSecret)
    return c.json(r, r.ok ? 200 : r.code === 'bad_request' || r.code === 'over_cap' ? 400 : 502)
  })
  // The human-approval step: exchanges a quote for a one-shot, reserved, mode-bound token.
  app.post('/api/passport/wallet/authorize', async (c) => {
    if (!walletOriginOk(c.req.header('origin'))) return c.json({ ok: false, error: 'forbidden' }, 403)
    const r = authorizeOrder(await jsonBody(c), config.snaplii, config.episodeSecret, config.episodeSecretIsDev, config.snaplii.live)
    return c.json(r, r.ok ? 200 : r.code === 'insecure_secret' ? 503 : 400)
  })
  app.post('/api/passport/wallet/purchase', async (c) => {
    if (!walletOriginOk(c.req.header('origin'))) return c.json({ ok: false, error: 'forbidden' }, 403)
    // Settles ONLY with a valid one-shot, amount/mode-bound approval token from /authorize.
    const r = await purchaseOrder(await jsonBody(c), config.snaplii, config.episodeSecret, config.snaplii.live)
    return c.json(r, r.ok ? 200 : r.code === 'upstream' || r.code === 'no_key' || r.code === 'uncertain' ? 502 : 400)
  })

  // Approval-to-phone (real push/SMS). request + status are same-origin (the web client);
  // phone-approve is the ONE intentionally-public route (the phone taps it) and is protected
  // by an unguessable, one-shot id — it carries no money authority of its own.
  app.post('/api/passport/notify/approval', async (c) => {
    if (!walletOriginOk(c.req.header('origin'))) return c.json({ ok: false, error: 'forbidden' }, 403)
    if (channelThrottled('notify', 40)) return c.json({ ok: false, error: 'rate_limited' }, 429)
    const r = await requestApproval(await jsonBody(c), config.notify)
    return c.json(r, 200)
  })
  app.get('/api/passport/notify/status', (c) => {
    if (!walletOriginOk(c.req.header('origin'))) return c.json({ ok: false, error: 'forbidden' }, 403)
    return c.json(approvalStatus(c.req.query('id') ?? ''))
  })
  // Public (id-protected). POST is the ntfy action target; GET renders a friendly page when
  // the link is opened in a browser. Both flip the same one-shot pending record.
  app.post('/api/passport/notify/phone-approve', (c) => {
    const r = phoneApprove(c.req.query('id') ?? '')
    return c.json({ ok: r.ok, status: r.status }, r.ok ? 200 : 404)
  })
  app.get('/api/passport/notify/phone-approve', (c) => {
    const r = phoneApprove(c.req.query('id') ?? '')
    return c.html(r.html, r.ok ? 200 : 404)
  })

  // Discord group message — server composes the content; webhook (or simulated preview).
  app.post('/api/passport/discord/send', async (c) => {
    if (!walletOriginOk(c.req.header('origin'))) return c.json({ ok: false, error: 'forbidden' }, 403)
    if (channelThrottled('discord', 20)) return c.json({ ok: false, error: 'rate_limited' }, 429)
    const r = await sendDiscord(await jsonBody(c), config.discord, config.demo)
    return c.json(r, r.ok ? 200 : 502)
  })

  // Order / place context (delivery address, items, ETA) for the run view. Same-origin only.
  app.get('/api/passport/order-context', (c) => {
    if (!walletOriginOk(c.req.header('origin'))) return c.json({ ok: false, error: 'forbidden' }, 403)
    return c.json({ ok: true, context: config.demo })
  })

  return app
}
