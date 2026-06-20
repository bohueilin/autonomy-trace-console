## Objective
Clean up the single-backend transition documentation so the GOAL’s “Single backend” checkbox is not undermined by false Vite env and middleware references.

## Scope
Change only:
- `.env.example`
- `README.md`
- `server/nebiusHandler.ts`
- `server/insforgeStore.ts`
- `vitest.config.ts`

Do NOT touch runtime behavior, route handlers, proxy config, tests, verifier, license, reward, scenarios, persistence logic, migrations, or UI code.

## Steps
1. In `.env.example`, remove the commented `VITE_BACKEND_ORIGIN=...` proxy override block. Keep only server-loaded env vars there.
2. In `README.md`, keep the proxy override documented, but make it explicit that it is a shell env for launching Vite, for example:
   ```bash
   VITE_BACKEND_ORIGIN=http://localhost:8788 npm run dev
   ```
   Do not imply `.env.local` controls Vite proxy config.
3. In `server/nebiusHandler.ts`, replace the header comment’s Vite middleware / `server/nebiusPlugin.ts` reference with standalone Hono server wording.
4. In `server/insforgeStore.ts`, replace “Vite middleware” in the header comment with standalone Node/Hono server wording.
5. In `vitest.config.ts`, update the stale comment about avoiding Vite middleware plugins; it should now say tests are independent from `vite.config.ts` and run in plain Node without starting the app/server.
6. Run:
   ```bash
   rg -n "server/nebiusPlugin|server/runEpisodePlugin|Vite middleware|middleware plugins|VITE_BACKEND_ORIGIN|loadEnv" .
   ```
   Confirm remaining `VITE_BACKEND_ORIGIN` references are only in `vite.config.ts` and README shell-env instructions, and that no current-architecture comments reference deleted plugin files or active Vite middleware.

## Acceptance criteria
- `.env.example` no longer contains `VITE_BACKEND_ORIGIN` or any Vite proxy override.
- README proxy override instructions match current `vite.config.ts` behavior: shell env only.
- No current comments reference deleted `server/nebiusPlugin.ts` / `server/runEpisodePlugin.ts`.
- No current comments describe `/api` or `/v1` as Vite middleware.
- No runtime code or behavior changes.

## Gates
```bash
npm run build
npm run lint
npm run verify:evidence
npm test
npm run gates
```
