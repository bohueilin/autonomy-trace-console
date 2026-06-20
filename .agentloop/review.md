## Review

**P0 (must-fix):** None.

**P1 (architecture):** None.

**P2 (quality):**
- `src/seedScenarios.test.ts:25` and `src/seedScenarios.test.ts:30` verify uniqueness and per-domain counts, but not the exact ID namespaces required by the design (`com-1..8`, `ops-1..8`, `rob-1..8`). Recommendation: add a focused assertion for the expected IDs so the corpus cannot drift while still passing balance tests.
- `.agentloop/design.md:7` scoped the round to six files, but `src/App.css:471` was also changed. The CSS itself is reasonable and low risk, but this is process drift. Recommendation: future UI designs should explicitly include CSS files in scope when presentation changes are expected.

Acceptance criteria are met: the corpus is 24 scenarios with 8 per domain and 5/3 train/heldout per domain (`src/seedScenarios.ts:22`, `src/seedScenarios.ts:555`), metadata is in the type and UI (`src/types.ts:35`, `src/components/ScenarioCard.tsx:20`), batch eval uses only `trainScenarios` (`src/App.tsx:118`, `src/App.tsx:126`), and held-out IDs remain server-addressable through existing registry lookup (`server/env/gym.ts:173`, `server/runEpisodeHandler.ts:159`). Verifier/license/evidence paths were not touched, and the referee shows build/lint/evidence/tests passing (`.agentloop/gates.log:6`, `.agentloop/gates.log:19`, `.agentloop/gates.log:23`, `.agentloop/gates.log:122`, `.agentloop/gates.log:127`).

**Verdict: ACCEPT** for this round’s change.

## Next design

**Objective:** Satisfy the GOAL “CI” checkbox by adding GitHub Actions that run the project gates on every PR.

**Scope:**
- Add `.github/workflows/gates.yml`.
- Do not touch verifier, license, gym, evidence, InsForge, scenario data, or app UI.
- Do not require Nebius, Vapi, InsForge secrets, or live network services.

**Steps:**
1. Create a GitHub Actions workflow named `gates`.
2. Trigger it on `pull_request` and `push` to the default branch.
3. Use `actions/checkout` and `actions/setup-node` with npm cache.
4. Use `npm ci`, not `npm install`, because `package-lock.json` exists.
5. Run `npm run gates`, which already covers build/typecheck, lint, evidence verification, and tests.
6. Keep the workflow secret-free and deterministic; it must pass with local/dev fallbacks only.

**Acceptance criteria:**
- `.github/workflows/gates.yml` exists.
- CI runs on every PR.
- CI executes `npm ci` and `npm run gates`.
- No secrets or live service credentials are referenced.
- Local gates remain green.

**Gates:**
```bash
npm run gates
```
