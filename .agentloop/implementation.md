All gates green. Implementation report below.

---

## Implementation report

### Plan evaluation
Accepted. The plan closes a real fail-open hole: a configured InsForge insert failure (`http_500`/`timeout`/`unreachable`) previously fell through to a successful `{ ok: true, persisted: false, reward, license }` — granting a reward/license on a verdict that was never durably saved. Failing closed enforces the GOAL's "Gym is canonical" trust boundary. Tight scope, no verifier/license/reward semantics touched.

### Files changed
- **`server/env/gym.ts`** — In `stepEpisode`'s configured-InsForge persistence block, added an `else if (out.status === 'unavailable')` branch that returns `{ ok: false, code: 'unknown', error: ... }` with no `reward`/`info`/`license`/`persisted`/`recordId`. Replaced the stale `// other unavailable / local_only -> best-effort` comment.
- **`server/env/gym.test.ts`** — Added two configured-InsForge tests: (1) insert returns HTTP 500, (2) insert POST throws (unreachable). Both assert `ok: false`, `code: 'unknown'`, and absence of all five leak-able fields.

### Key decisions
- The new branch is placed after `existing` / `conflict_reread_failed` / `saved`, so those keep their existing handling; only the remaining `unavailable` codes hit the fail-closed path. `local_only` cannot occur inside this branch (it's guarded by `insforgeConfigured`), and `conflict_reread_failed` is already handled above — documented inline.
- The "unreachable" test throws from the POST mock; `persistEpisodeOnce` catches it and maps it to `unavailable`/`unreachable` (insforgeStore.ts:214), exercising the new branch via the real store code path.
- Unconfigured dev fallback (the `else` branch) is untouched.

### Gate results — all PASS
- `npm run build` — ✅ tsc + vite build clean
- `npm run lint` — ✅ no errors
- `npm run verify:evidence` — ✅ ALL CHECKS PASSED (40 checks)
- `npm test` — ✅ 37 passed (35 prior + 2 new)
- `npm run gates` — ✅ green

### Deferred / open questions for Codex
- None deferred within scope. Adjacent observation (not done, flagging only): the legacy `/api/run-episode` path and `insforgeStore.ts` were explicitly out of scope this round — if they have a comparable best-effort-persist-then-return-reward path, that would be a candidate for a future round to keep the fail-closed invariant uniform across both evidence paths.
