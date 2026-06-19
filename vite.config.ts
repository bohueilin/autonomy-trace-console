import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { nebiusApiPlugin } from './server/nebiusPlugin'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env vars (including non-VITE_ keys) for SERVER-SIDE use only. These are
  // passed into the Node-only middleware below and are never injected into the
  // client bundle — Vite only exposes VITE_-prefixed vars to the browser, so the
  // NEBIUS_API_KEY stays on the server.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      nebiusApiPlugin({
        apiKey: env.NEBIUS_API_KEY || process.env.NEBIUS_API_KEY,
        model: env.NEBIUS_MODEL || process.env.NEBIUS_MODEL,
        baseUrl: env.NEBIUS_BASE_URL || process.env.NEBIUS_BASE_URL,
      }),
    ],
    // Honor a PORT env var (used by preview/CI tooling); fall back to Vite's default.
    server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
  }
})
