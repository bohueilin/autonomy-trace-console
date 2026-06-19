// ----------------------------------------------------------------------------
// PROTOTYPE server-owned episode + evidence endpoints, as Vite dev middleware:
//   POST /api/run-episode   — run one server-authoritative episode, persist it
//   GET  /api/runs/recent   — recent server-owned episodes (in-memory history)
//
// Runs in the Node process only; InsForge/Nebius credentials never reach the client.
// ----------------------------------------------------------------------------

import type { Plugin, ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  getEvidenceStatus,
  getRecentRuns,
  handleRunEpisode,
  type RunEpisodeConfig,
} from './runEpisodeHandler'

const MAX_BODY = 1_000_000 // 1 MB cap

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > MAX_BODY) reject(new Error('body too large'))
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(payload))
}

export function runEpisodeApiPlugin(cfg: RunEpisodeConfig): Plugin {
  return {
    name: 'run-episode-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/run-episode', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, code: 'bad_request', error: 'Use POST.' })
          return
        }
        try {
          const raw = await readBody(req)
          const body: unknown = raw ? JSON.parse(raw) : {}
          const result = await handleRunEpisode(body, cfg)
          if (!result.ok) {
            sendJson(res, result.code === 'bad_request' ? 400 : 502, result)
            return
          }
          // Send a CLIENT-SAFE subset — the full auditRow (incl. scenario_snapshot
          // and attempted/actual policy inputs) stays server-side.
          sendJson(res, 200, {
            ok: true,
            trace: result.trace,
            license: result.license,
            persistence: result.persistence,
            runId: result.runId,
          })
        } catch {
          sendJson(res, 400, { ok: false, code: 'bad_request', error: 'Invalid request.' })
        }
      })

      server.middlewares.use('/api/runs/recent', (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'Use GET.' })
          return
        }
        sendJson(res, 200, { ok: true, runs: getRecentRuns(10) })
      })

      server.middlewares.use('/api/evidence/status', (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'Use GET.' })
          return
        }
        sendJson(res, 200, { ok: true, ...getEvidenceStatus(cfg) })
      })
    },
  }
}
