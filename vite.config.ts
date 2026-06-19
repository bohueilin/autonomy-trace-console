import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Honor a PORT env var (used by preview/CI tooling); fall back to Vite's default.
  server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
})
