import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { nebiusApiPlugin } from './server/nebiusPlugin'
import { runEpisodeApiPlugin } from './server/runEpisodePlugin'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env vars (including non-VITE_ keys) for SERVER-SIDE use only. These are
  // passed into the Node-only middleware below and are never injected into the
  // client bundle — Vite only exposes VITE_-prefixed vars to the browser, so the
  // NEBIUS_API_KEY / INSFORGE_API_KEY stay on the server.
  const env = loadEnv(mode, process.cwd(), '')

  const nebius = {
    apiKey: env.NEBIUS_API_KEY || process.env.NEBIUS_API_KEY,
    model: env.NEBIUS_MODEL || process.env.NEBIUS_MODEL,
    baseUrl: env.NEBIUS_BASE_URL || process.env.NEBIUS_BASE_URL,
  }
  const insforge = {
    baseUrl: env.INSFORGE_BASE_URL || process.env.INSFORGE_BASE_URL,
    apiKey: env.INSFORGE_API_KEY || process.env.INSFORGE_API_KEY,
  }

  return {
    plugins: [
      react(),
      nebiusApiPlugin(nebius),
      runEpisodeApiPlugin({ nebius, insforge }),
    ],
    server: {
      // Honor a PORT env var (used by preview/CI tooling); fall back to default.
      ...(process.env.PORT ? { port: Number(process.env.PORT) } : {}),
      // Allow public tunnels (ngrok / cloudflared / localtunnel) to reach the dev
      // server so the Vapi operator webhook can call /api/vapi/tools.
      allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.io', '.loca.lt'],
    },
  }
})
