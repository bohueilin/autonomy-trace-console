// ----------------------------------------------------------------------------
// PROTOTYPE InsForge evidence store for the hackathon — NOT production-hardened.
//
// Runs ONLY in the Node process (Vite middleware). The InsForge service key
// (INSFORGE_API_KEY, an `ins_...` admin key) lives here and is never sent to the
// browser. InsForge is EVIDENCE STORAGE ONLY — it never computes or overrides the
// deterministic verifier. Persistence is best-effort: this module never throws,
// and the app works fully when InsForge is unconfigured.
//
// Insert API (per docs): POST {BASE}/api/database/records/{table}
//   headers: Authorization: Bearer <key>, Content-Type: application/json,
//            Prefer: return=representation
//   body: an ARRAY of row objects; response: array of created rows incl. `id`.
// ----------------------------------------------------------------------------

export interface InsforgeConfig {
  baseUrl?: string
  apiKey?: string
  timeoutMs?: number
}

export type PersistOutcome =
  | { status: 'saved'; recordId: string | null }
  | { status: 'local_only' } // InsForge not configured
  | { status: 'unavailable'; code: string }

export type ReadOutcome =
  | { status: 'ok'; rows: Record<string, unknown>[] }
  | { status: 'local_only' } // InsForge not configured
  | { status: 'unavailable' } // network / timeout / non-2xx
  | { status: 'error' } // parse failure

/** The single audit table this milestone writes to. */
export const INSFORGE_TABLE = 'eval_episodes'

export function insforgeConfigured(cfg: InsforgeConfig): boolean {
  return Boolean(cfg.baseUrl && cfg.apiKey)
}

/** Persist one episode audit row. Never throws; returns a typed outcome. */
export async function persistEpisode(
  row: Record<string, unknown>,
  cfg: InsforgeConfig,
): Promise<PersistOutcome> {
  if (!insforgeConfigured(cfg)) {
    return { status: 'local_only' }
  }

  const base = cfg.baseUrl!.replace(/\/+$/, '')
  const url = `${base}/api/database/records/${INSFORGE_TABLE}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 8000)

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.apiKey}`,
        prefer: 'return=representation',
      },
      body: JSON.stringify([row]), // body must be an array, even for one record
      signal: controller.signal,
    })

    if (!resp.ok) {
      // Never surface upstream bodies or the key — log server-side only.
      console.error(`[insforge] insert ${resp.status} ${resp.statusText}`)
      return { status: 'unavailable', code: `http_${resp.status}` }
    }

    let recordId: string | null = null
    try {
      const data = (await resp.json()) as unknown
      if (Array.isArray(data)) {
        recordId = (data[0] as { id?: string } | undefined)?.id ?? null
      } else if (data && typeof data === 'object') {
        recordId = (data as { id?: string }).id ?? null
      }
    } catch {
      // saved, but response wasn't parseable — leave recordId null.
    }
    return { status: 'saved', recordId }
  } catch (err) {
    const aborted = (err as { name?: string } | undefined)?.name === 'AbortError'
    console.error('[insforge] insert failed:', aborted ? 'timeout' : err)
    return { status: 'unavailable', code: aborted ? 'timeout' : 'unreachable' }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Read back the newest server-authoritative evidence rows. Best-effort: never
 * throws, never surfaces the key / raw errors / base URL. Filters server-side to
 * trace_authority === 'server_authoritative_episode', newest first.
 */
export async function fetchRecentEvidence(
  cfg: InsforgeConfig,
  limit = 50,
): Promise<ReadOutcome> {
  if (!insforgeConfigured(cfg)) {
    return { status: 'local_only' }
  }

  const base = cfg.baseUrl!.replace(/\/+$/, '')
  const query =
    `?trace_authority=eq.server_authoritative_episode` +
    `&order=created_at.desc&limit=${Math.max(1, Math.min(1000, limit))}`
  const url = `${base}/api/database/records/${INSFORGE_TABLE}${query}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 8000)

  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: { authorization: `Bearer ${cfg.apiKey}` },
      signal: controller.signal,
    })
    if (!resp.ok) {
      console.error(`[insforge] read ${resp.status} ${resp.statusText}`)
      return { status: 'unavailable' }
    }
    const data = (await resp.json()) as unknown
    if (!Array.isArray(data)) {
      console.error('[insforge] read: unexpected response shape')
      return { status: 'error' }
    }
    return { status: 'ok', rows: data as Record<string, unknown>[] }
  } catch (err) {
    const aborted = (err as { name?: string } | undefined)?.name === 'AbortError'
    console.error('[insforge] read failed:', aborted ? 'timeout' : err)
    return { status: 'unavailable' }
  } finally {
    clearTimeout(timer)
  }
}
