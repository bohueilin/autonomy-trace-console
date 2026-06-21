# Deploy — public demo URL (Cloudflare Pages)

The frontend is a static Vite SPA. The deterministic core — oracle/verifier,
warehouse env, Train Eval, license math — runs **entirely in the browser**, so a
static deploy gives a fully working demo with **no backend and no secrets**.
Server-only features (live model runs, voice structuring, server gym episodes,
evidence store) are disabled in-app and clearly labeled when no backend is set.

## Build settings (the important bits)

| Setting | Value |
| --- | --- |
| Framework preset | None / Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | 20 (set `NODE_VERSION=20` if Pages defaults older) |
| Production branch | `codex/physical-ai-license` (or `main` after merge) |

SPA routing is handled by `public/_redirects` (`/* /index.html 200`).

## Option A — Cloudflare Pages connected to GitHub (recommended, ~2 min)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**.
2. Authorize GitHub and pick **`bohueilin/autonomy-trace-console`**.
3. Set the production branch to **`codex/physical-ai-license`**.
4. Build command **`npm run build`**, output directory **`dist`**.
5. (Optional) Variables → add **`NODE_VERSION` = `20`**. Do **not** add any
   `VITE_*` secret. Leave `VITE_API_BASE_URL` unset for the static demo.
6. **Save and Deploy** → you get `https://<project>.pages.dev`. Every push to the
   branch redeploys automatically.

## Option B — Wrangler CLI (if you have a Cloudflare API token)

```bash
# one-time
export CLOUDFLARE_API_TOKEN=...   # Pages:Edit token; never commit it
npm run build
npx wrangler pages deploy dist --project-name autonomy-license --branch codex/physical-ai-license
```

Without a token, `wrangler` needs an interactive `wrangler login` (opens a
browser). Use Option A if you can't complete that.

## Connecting a backend later (optional, do NOT rush in the final hour)

The backend (`server/main.ts`, Hono) is a standalone Node server. To make the
public frontend use it:

1. Deploy the server somewhere with the server-side secrets (`EPISODE_SIGNING_SECRET`,
   `NEBIUS_*`, `MINIMAX_*`, `INSFORGE_*`) — Render/Fly/Railway/a Cloudflare Worker.
2. In Pages → Variables, set **`VITE_API_BASE_URL=https://<your-backend-host>`**
   (public URL only) and redeploy.
3. The backend must send permissive CORS for the Pages origin on `/api` and `/v1`.

`src/apiConfig.ts` prefixes every `/api` and `/v1` call with `VITE_API_BASE_URL`
when set; when unset, `SERVER_ENABLED` is false and server features short-circuit
to graceful "unavailable" states.

## Secrets — never exposed

- `VITE_*` is the only browser-visible namespace; it holds public values only.
- All service keys stay in `.env.local` (gitignored) / server host / Pages
  *server-side* secrets — never in `VITE_*`, never in the client bundle.
