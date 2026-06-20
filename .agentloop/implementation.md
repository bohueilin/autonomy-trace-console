All gates pass.

---

## Implementation report

**Round scope:** Documentation-only cleanup to align the single-backend transition docs with current architecture. No runtime behavior touched. Plan was sound and low-risk — implemented as written.

### Files changed
- **`.env.example`** — Removed the commented `VITE_BACKEND_ORIGIN` proxy-override block (lines 9–11). The file now lists only server-loaded env vars.
- **`README.md`** — Both proxy-override mentions (the dev quick-start at ~L105 and the Nebius "Run" section at ~L161) now state explicitly that `VITE_BACKEND_ORIGIN` is a **shell env passed when launching Vite** (read by `vite.config.ts`, not `.env.local`), with the example `VITE_BACKEND_ORIGIN=http://localhost:8788 npm run dev`.
- **`server/nebiusHandler.ts`** — Header comment: replaced "wired in as Vite dev middleware, see server/nebiusPlugin.ts" with "called by the standalone Hono server, server/main.ts".
- **`server/insforgeStore.ts`** — Header comment: replaced "(Vite middleware)" with "(the standalone Hono server, server/main.ts)".
- **`vitest.config.ts`** — Comment now says tests run in plain Node "without starting the app or the standalone gym server" instead of the stale "Vite dev middleware plugins (which boot the gym server)" wording.

### Key decisions
- Kept the live `VITE_BACKEND_ORIGIN` reference in `vite.config.ts` untouched (it's the actual code that reads the var) — per acceptance criteria, that's where it should remain.
- Phrased the README override as a fenced shell command in the quick-start and inline for the Nebius section, matching the surrounding prose density.

### Step 6 verification (rg sweep)
Remaining matches are exactly the allowed set: `vite.config.ts` (the code) and README shell-env instructions. No comments reference deleted `server/nebiusPlugin.ts` / `server/runEpisodePlugin.ts`, no active "Vite middleware" descriptions, no `loadEnv`.

### Gate results — all PASS
- `npm run build` — ✓ tsc + vite build (built in 74ms)
- `npm run lint` — ✓ clean
- `npm run verify:evidence` — ✓ ALL CHECKS PASSED (40 checks)
- `npm test` — ✓ 6 files, 40 tests passed
- `npm run gates` — ✓ ALL CHECKS PASSED

### Deferred / open questions for Codex
- None deferred within scope. Adjacent (not done, flagging only): the GOAL's "Single backend" box also depends on the legacy `/api/*` + Vite-middleware *runtime* being fully removed in favor of the proxy — this round only fixed docs/comments, not whether any middleware still exists in code. If that runtime removal is still pending, it's a candidate for a future round's design.
