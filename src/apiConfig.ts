// Frontend API base URL — PUBLIC value only, never a secret.
//
// `VITE_API_BASE_URL` (optional) points the static frontend at a backend on a
// different origin (e.g. a Cloudflare Worker, Render, or Fly URL). It must only
// ever hold a public base URL — never a MiniMax/Nebius/InsForge service key.
// Those stay server-side. See DEPLOY.md.
//
// Resolution:
//   - empty (default): same-origin relative paths. In `vite dev` these are
//     proxied to the local Hono server; on a static-only host they 404, so we
//     treat the backend as DISABLED (SERVER_ENABLED=false) and the UI degrades
//     to the fully client-side deterministic demo.
//   - set: every /api and /v1 call is prefixed with it (cross-origin backend).
const RAW_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
const API_BASE = RAW_BASE.replace(/\/+$/, '')

export const API_BASE_URL = API_BASE

// A backend is reachable when either we're in `vite dev` (the proxy is up) or a
// public base URL was configured for the build. A static production build with
// no base URL has no backend, so server-only features degrade gracefully.
export const SERVER_ENABLED: boolean = import.meta.env.DEV || API_BASE.length > 0

/** Prefix an /api or /v1 path with the configured base (same-origin if unset). */
export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return API_BASE ? `${API_BASE}${p}` : p
}
