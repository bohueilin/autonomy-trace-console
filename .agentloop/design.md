## Objective
Make the standalone Hono server the only development backend, satisfying the GOAL “Single backend” checkbox by removing Vite-owned `/api/*` middleware and proxying frontend traffic to `server/main.ts`.

## Scope
Change only:
- `vite.config.ts`
- `package.json`
- `README.md`
- `.env.example`
- Delete `server/nebiusPlugin.ts`
- Delete `server/runEpisodePlugin.ts`

Do NOT touch:
- `server/main.ts` route behavior
- `server/runEpisodeHandler.ts`
- `server/nebiusHandler.ts`
- `server/env/gym.ts`
- verifier, reward, license, digest, scenario, persistence, or UI semantics
- migrations or InsForge store APIs

## Steps
1. In `vite.config.ts`, remove all imports and registration of:
   - `nebiusApiPlugin`
   - `runEpisodeApiPlugin`

2. Remove the now-unneeded Vite-side env loading and config object construction from `vite.config.ts`; secrets should no longer be read by Vite at all.

3. Keep `react()` as the only Vite plugin.

4. Add Vite dev-server proxy config:
   - `/api` targets the standalone server.
   - `/v1` targets the standalone server.
   - Default target is `http://localhost:8787`.
   - Allow override with a non-secret env var such as `VITE_BACKEND_ORIGIN` or `BACKEND_ORIGIN`.
   - Use `changeOrigin: true`.

5. Preserve the existing `server.allowedHosts` list in `vite.config.ts`.

6. Update `package.json` scripts so local development is explicit:
   - Keep `server`: `node server/main.ts`.
   - Keep `dev`: `vite`.
   - Add a clear client alias if useful, e.g. `dev:client`: `vite`.
   - Do not add new dependencies just to run two processes.

7. Delete `server/nebiusPlugin.ts` and `server/runEpisodePlugin.ts`. Their route logic already exists in `server/main.ts`; do not move or duplicate code.

8. Update `.env.example` comments:
   - Say server-side secrets are read by `server/main.ts` / `server/config.ts`, not Vite middleware.
   - Keep `PORT=8787` as the standalone server default.
   - Document optional frontend proxy override if added.

9. Update only the README sections that currently claim:
   - “There is no separate server to start.”
   - APIs live as Vite middleware.
   - `server/nebiusPlugin.ts` and `server/runEpisodePlugin.ts` are active architecture.

   Replace with:
   - Start backend with `npm run server`.
   - Start frontend with `npm run dev`.
   - Vite proxies `/api` and `/v1` to the standalone server.
   - `server/main.ts` is the only backend route owner.

10. Run a repo search to confirm no active references remain to:
   - `nebiusApiPlugin`
   - `runEpisodeApiPlugin`
   - `server/nebiusPlugin`
   - `server/runEpisodePlugin`
   - “Vite middleware” claims in current architecture docs, except historical notes if clearly marked obsolete.

## Acceptance criteria
- `vite.config.ts` no longer imports, constructs config for, or registers backend middleware plugins.
- `server/nebiusPlugin.ts` and `server/runEpisodePlugin.ts` are gone.
- Vite dev proxies both `/api/*` and `/v1/*` to the standalone Hono server at port `8787` by default.
- `server/main.ts` remains the only runtime owner of `/health`, `/api/*`, and `/v1/*`.
- No verifier, reward, license, digest, persistence, scenario, or UI response semantics change.
- README and `.env.example` no longer instruct users that Vite middleware is the backend.
- Existing evidence, fail-closed, and gym tests remain green.

## Gates
```bash
npm run build
npm run lint
npm run verify:evidence
npm test
npm run gates
```
