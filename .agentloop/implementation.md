All changes in place. Implementation complete.

## Implementation report

Made the standalone Hono server the only dev backend, per `design.md`.

### Files changed
- **`vite.config.ts`** — Removed `loadEnv` import and the two plugin imports; dropped all server-side env loading and the `nebius`/`insforge` config construction (Vite no longer reads secrets). `react()` is now the only plugin. Added a dev-server proxy: `/api` and `/v1` → backend origin, `changeOrigin: true`, default `http://localhost:8787`, overridable via `VITE_BACKEND_ORIGIN` (falls back to `BACKEND_ORIGIN`). Preserved the existing `allowedHosts` list and the `PORT` handling.
- **`package.json`** — Added `"dev:client": "vite"` alias. Kept `server` and `dev` unchanged. No new dependencies.
- **`server/nebiusPlugin.ts`**, **`server/runEpisodePlugin.ts`** — Deleted (`git rm`). Their route logic already lives in `server/main.ts`; nothing moved or duplicated.
- **`.env.example`** — Clarified secrets are read by `server/main.ts`/`server/config.ts` (not Vite), documented the two-process dev flow, kept `PORT=8787`, and documented the optional non-secret `VITE_BACKEND_ORIGIN` proxy override.
- **`README.md`** — Updated the "no separate server" / "API lives as Vite middleware" claims to the two-command flow (`npm run server` + `npm run dev`, Vite proxies `/api` + `/v1`); removed the "why middleware" rationale block; corrected the `loadEnv` secret-handling paragraph; replaced the deleted plugin rows in the project-layout table with a `server/main.ts` row; updated the two smoke-check `npm run dev` lines to include `npm run server`.

### Key decisions
- Used `process.env` (not `loadEnv`) for the proxy origin since it's a non-secret build-time setting and the design says Vite should no longer read env via `loadEnv`.
- Updated two smoke-checklist `npm run dev` references for accuracy (the backend is now a separate process) — these are within the README scope of the plan.

### Gate results — all pass
- `npm run build` ✅ (tsc -b + vite build, 222 kB bundle)
- `npm run lint` ✅ (clean)
- `npm run verify:evidence` ✅ (40/40 checks)
- `npm test` ✅ (6 files, 40 tests)

### Open questions for Codex
- `server/nebiusHandler.ts:5` has a stale comment cross-referencing `server/nebiusPlugin.ts` ("see server/nebiusPlugin.ts"). It's a comment only (no code dependency), and that file is in the design's "Do NOT touch" list, so I left it. Worth a one-line comment fix in a future round.
- The frontend uses same-origin relative paths (`/api/...`, `/v1/...`) so the proxy covers dev. For `vite preview`/production-static hosting there's no proxy — the standalone server is the intended prod backend, consistent with the GOAL's deployability item (a later round).
