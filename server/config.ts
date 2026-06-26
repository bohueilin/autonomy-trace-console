// ----------------------------------------------------------------------------
// Typed configuration for the standalone server.
//
// Loads from process.env, falling back to a .env.local file (dependency-free, so
// no dotenv needed). Validates required values and collects human-readable
// warnings instead of crashing — the server should boot in a degraded mode
// (e.g. no InsForge) for local dev, and fail loudly only on hard prod errors.
// ----------------------------------------------------------------------------

import fs from 'node:fs'
import path from 'node:path'

export interface NebiusConfig {
  apiKey?: string
  model?: string
  baseUrl?: string
}

export interface InsforgeConfig {
  baseUrl?: string
  apiKey?: string
}

/** GMI Cloud — OpenAI-compatible serverless inference (the agent's brain). */
export interface GmiConfig {
  apiKey?: string
  model?: string
  baseUrl?: string
}

/** Snaplii — real, scoped agent payments. Key is server-side only. */
export interface SnapliiConfig {
  apiKey?: string
  baseUrl: string
  /** Server-enforced ceiling per single purchase (USD), independent of Snaplii's own cap. */
  perBuyCapUsd: number
  /** Server-enforced ceiling for total approved spend this process (USD). */
  dailyCapUsd: number
}

export interface AppConfig {
  port: number
  isProd: boolean
  nebius: NebiusConfig
  insforge: InsforgeConfig
  gmi: GmiConfig
  snaplii: SnapliiConfig
  /** HMAC secret for signing stateless episode tokens + purchase-approval tokens. */
  episodeSecret: string
  /** Non-fatal configuration warnings to log at startup. */
  warnings: string[]
}

const DEV_EPISODE_SECRET = 'dev-insecure-episode-secret-change-me'

/** Parse a .env.local file into a flat map. Returns {} if absent. */
function readDotEnvLocal(cwd: string): Record<string, string> {
  const file = path.join(cwd, '.env.local')
  if (!fs.existsSync(file)) return {}
  const out: Record<string, string> = {}
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return out
}

export function loadConfig(cwd: string = process.cwd()): AppConfig {
  const file = readDotEnvLocal(cwd)
  // process.env always wins over .env.local (prod injects real env).
  const get = (k: string): string | undefined => process.env[k] ?? file[k] ?? undefined

  const isProd = (get('NODE_ENV') ?? 'development') === 'production'
  const warnings: string[] = []

  const nebius: NebiusConfig = {
    apiKey: get('NEBIUS_API_KEY'),
    model: get('NEBIUS_MODEL'),
    baseUrl: get('NEBIUS_BASE_URL'),
  }
  const insforge: InsforgeConfig = {
    baseUrl: get('INSFORGE_BASE_URL'),
    apiKey: get('INSFORGE_API_KEY'),
  }

  const gmi: GmiConfig = {
    apiKey: get('GMI_API_KEY'),
    model: get('GMI_MODEL'),
    baseUrl: get('GMI_BASE_URL'),
  }
  const snaplii: SnapliiConfig = {
    apiKey: get('SNAPLII_API_KEY'),
    baseUrl: (get('SNAPLII_BASE_URL') ?? 'https://aipayment.snaplii.com').replace(/\/+$/, ''),
    perBuyCapUsd: Number(get('SNAPLII_PER_BUY_CAP_USD') ?? '60'),
    dailyCapUsd: Number(get('SNAPLII_DAILY_CAP_USD') ?? '120'),
  }

  if (!nebius.apiKey) warnings.push('NEBIUS_API_KEY not set — the Nebius reference agent will be unavailable.')
  if (!insforge.baseUrl || !insforge.apiKey) {
    warnings.push('INSFORGE_* not set — per-run license history falls back to in-memory (single instance).')
  }
  if (!gmi.apiKey) warnings.push('GMI_API_KEY not set — voice intent falls back to deterministic keyword matching.')
  if (!snaplii.apiKey) warnings.push('SNAPLII_API_KEY not set — the wallet runs in mock mode (no real purchases).')

  let episodeSecret = get('EPISODE_SIGNING_SECRET') ?? ''
  if (!episodeSecret) {
    if (isProd) {
      throw new Error('EPISODE_SIGNING_SECRET is required in production (signs stateless episode tokens).')
    }
    episodeSecret = DEV_EPISODE_SECRET
    warnings.push('EPISODE_SIGNING_SECRET not set — using an insecure dev secret. Do NOT use in production.')
  }

  const port = Number(get('PORT') ?? '8787')
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT: ${get('PORT')}`)
  }

  return { port, isProd, nebius, insforge, gmi, snaplii, episodeSecret, warnings }
}
