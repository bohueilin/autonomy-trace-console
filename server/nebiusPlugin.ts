// ----------------------------------------------------------------------------
// PROTOTYPE server-side boundary for the hackathon.
//
// Exposes POST /api/nebius-action as Vite dev-server middleware. This runs in the
// Node process only — the key passed in via config never reaches the client
// bundle. (Tradeoff: this endpoint exists under `vite` dev, not in a static
// `vite preview`. For the demo we always run `npm run dev`. A standalone server
// would be the production path.)
// ----------------------------------------------------------------------------

import type { Plugin, ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  handleNebiusAction,
  type NebiusErrorCode,
  type NebiusHandlerConfig,
} from './nebiusHandler'

// Typed error -> HTTP status. Keep in sync with NebiusErrorCode.
function statusFor(code: NebiusErrorCode): number {
  switch (code) {
    case 'bad_request':
      return 400
    case 'no_key':
      return 503
    case 'timeout':
      return 504
    case 'upstream':
    case 'parse':
    case 'unknown':
      return 502
  }
}

const MAX_BODY = 1_000_000 // 1 MB cap — these requests are tiny.

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

export function nebiusApiPlugin(cfg: NebiusHandlerConfig): Plugin {
  return {
    name: 'nebius-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/nebius-action', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, code: 'bad_request', error: 'Use POST.' })
          return
        }
        try {
          const raw = await readBody(req)
          const body: unknown = raw ? JSON.parse(raw) : {}
          const result = await handleNebiusAction(body, cfg)
          const status = result.ok ? 200 : statusFor(result.code)
          sendJson(res, status, result)
        } catch {
          sendJson(res, 400, { ok: false, code: 'bad_request', error: 'Invalid request.' })
        }
      })
    },
  }
}
