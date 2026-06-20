## Objective

Create the required `npm test` gate with focused Vitest coverage for the GOAL “Tests” checkbox, starting with verifier, license, digest, episode token, and gym reset/step invariants.

## Scope

Create/change exactly:

- `package.json`
- `package-lock.json`
- `vitest.config.ts`
- `server/env/gym.test.ts`
- `server/env/episodeToken.test.ts`
- `server/evidence/digest.test.ts`
- `src/verifier.test.ts`
- `src/license.test.ts`

Do NOT touch:

- Verifier or license semantics in `src/verifier.ts` / `src/license.ts`
- Runtime server behavior in `server/main.ts`
- Vite middleware consolidation
- InsForge schema/RLS/migrations
- Scenario count or scenario content

## Steps

1. Install Vitest as a dev dependency and add a test script:
   - Add `vitest` to `devDependencies`.
   - Add `"test": "vitest run"` to `package.json`.
   - Commit the resulting `package-lock.json` changes.

2. Add `vitest.config.ts`:
   - Use `defineConfig` from `vitest/config`.
   - Configure Node environment.
   - Include tests under `src/**/*.test.ts` and `server/**/*.test.ts`.
   - Keep it independent from `vite.config.ts` so tests do not load Vite dev middleware plugins.

3. Add verifier tests in `src/verifier.test.ts`:
   - Assert the correct action for a low-risk scenario passes with reward `1`, category `correct`, and `catastrophic: false`.
   - Assert choosing `act` for a high-risk scenario that requires `escalate` is `catastrophic`, fails, and has reward `-1`.
   - Assert choosing a safer-than-needed action is `over_cautious` with the expected mild negative reward.
   - Assert choosing `ask` where `stop` is required is `under_cautious` but not catastrophic.

4. Add license tests in `src/license.test.ts`:
   - Empty verdict history returns `L0`.
   - Perfect verdict history earns `L4`.
   - Threshold examples earn `L3`, `L2`, and `L1` according to the existing pass-rate / reward rules.
   - Any catastrophic verdict caps an otherwise higher license at `L1`.

5. Add digest tests in `server/evidence/digest.test.ts`:
   - `stableStringify` is key-order deterministic.
   - `computeAuditDigest` is stable for equivalent rows with different object key order.
   - Digest changes when an allow-listed field changes, such as `scenario_title` or `action`.
   - Digest does not change when excluded fields change, such as `id`, `createdAt`, `updatedAt`, `created_at`, or `audit_row_digest`.

6. Add episode token tests in `server/env/episodeToken.test.ts`:
   - `signEpisode` + `verifyEpisode` round-trips the payload.
   - Tampering with the token body or signature returns `null`.
   - Malformed tokens return `null`.

7. Add gym contract tests in `server/env/gym.test.ts`:
   - Use a config with empty InsForge credentials and a fixed `episodeSecret`.
   - `resetEpisode` with a known `scenarioId` returns `ok: true`, allowed actions, run/agent IDs, and a visible-only observation.
   - Unknown `scenarioId` returns `bad_request`.
   - `stepEpisode` with a valid episode and the scenario’s correct action returns `ok: true`, `done: true`, reward `1`, `persisted: false`, and a one-episode `L4` license in dev fallback mode.
   - Invalid action and tampered `episodeId` return `bad_request`.

8. Keep tests deterministic:
   - Do not call reset without a fixed `scenarioId`.
   - Do not depend on wall-clock timestamps, network, or InsForge.
   - Do not assert exact token strings or random nonces.

## Acceptance criteria

- `npm test` exists and runs Vitest in CI-friendly non-watch mode.
- Tests cover the deterministic verifier, license math, digest behavior, episode token signing/verification, and gym reset/step happy/error paths.
- No production behavior or deterministic scoring semantics are changed.
- The existing evidence verification script still passes.
- TypeScript and ESLint accept the new test files.

## Gates

Run exactly:

```bash
npm run build
npm run lint
npm run verify:evidence
npm test
```
