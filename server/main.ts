// ----------------------------------------------------------------------------
// Standalone, deployable server (Hono). Replaces the Vite dev middleware.
//
//   npm run server        # node server/main.ts  (loads .env.local / process.env)
//
// Exposes:
//   GET  /health
//   Gym (RL env, external policy):
//     POST /v1/episodes                      reset -> { episodeId, observation }
//     POST /v1/episodes/:episodeId/step      step  -> { reward, done, info, license }
//     POST /v1/step                          step  (episodeId in body)
//   Legacy (current UI + reference flows), reusing existing handlers:
//     POST /api/run-episode, GET /api/runs/recent, GET /api/evidence/status,
//     POST /api/nebius-action, POST /api/vapi/tools
// ----------------------------------------------------------------------------

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { loadConfig } from './config.ts'
import { ENVIRONMENT_NAME } from './evalVersions.ts'
import { resetEpisode, stepEpisode, type GymConfig } from './env/gym.ts'
import type { NebiusErrorCode } from './nebiusHandler.ts'
import { handleNebiusAction } from './nebiusHandler.ts'
import { getEvidenceStatus, getRecentRuns, handleRunEpisode } from './runEpisodeHandler.ts'
import { handleVapiTools } from './vapiHandler.ts'

const config = loadConfig()
for (const w of config.warnings) console.warn('[config]', w)

const runCfg = { nebius: config.nebius, insforge: config.insforge }
const gymCfg: GymConfig = { insforge: config.insforge, episodeSecret: config.episodeSecret }

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

const app = new Hono()
app.use('*', cors())

app.get('/health', (c) =>
  c.json({ ok: true, environment: ENVIRONMENT_NAME, time: new Date().toISOString() }),
)

// ---- Gym env (external policy) -------------------------------------------
app.post('/v1/episodes', async (c) => {
  const r = resetEpisode(await jsonBody(c), gymCfg)
  return c.json(r, r.ok ? 200 : 400)
})

const step = async (body: Record<string, unknown>) => stepEpisode(body, gymCfg)
const stepStatus = (r: { ok: boolean; code?: string }): ContentfulStatusCode =>
  r.ok ? 200 : r.code === 'bad_request' ? 400 : 502

app.post('/v1/episodes/:episodeId/step', async (c) => {
  const r = await step({ ...(await jsonBody(c)), episodeId: c.req.param('episodeId') })
  return c.json(r, stepStatus(r))
})
app.post('/v1/step', async (c) => {
  const r = await step(await jsonBody(c))
  return c.json(r, stepStatus(r))
})

// ---- Legacy /api (reuses existing server-owned handlers) ------------------
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

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[gym] ${ENVIRONMENT_NAME} server listening on http://localhost:${info.port}`)
})
