## Review

**P0 (must-fix):** None.

**P1 (architecture):** None.

**P2 (quality):**
- `.agentloop/implementation.md:5-7` and `.agentloop/implementation.md:19` claim `.github/workflows/gates.yml` was the only touched file, but `git diff HEAD~1` also includes `.agentloop/STATE.json`, `.agentloop/design.md`, `.agentloop/implementation.md`, and `.agentloop/review.md`. Recommendation: keep implementation reports precise by saying “product change only” when loop metadata also changed.
- `.github/workflows/gates.yml:17` and `.github/workflows/gates.yml:20` pin actions only to major versions. This is acceptable for the design, but weaker than tamper-resistant CI. Recommendation: pin third-party actions to full SHAs if the project wants the CI gate itself to be supply-chain hardened.

Acceptance criteria are met. The workflow exists, runs on `pull_request` and `push` to `main`, uses `checkout`, `setup-node`, `npm ci`, and `npm run gates`, and does not reference secrets (`.github/workflows/gates.yml:1-29`). The script it runs is the intended full referee gate (`package.json:9-15`). Local gates truly pass: build, lint, evidence verification, and tests all ran, with evidence 40/40 and Vitest 83/83 (`.agentloop/gates.log:2-3`, `.agentloop/gates.log:67`, `.agentloop/gates.log:122-127`). Application trust boundaries, RL environment behavior, license logic, evidence digesting, and InsForge persistence were not changed in this round.

**Verdict: ACCEPT** for this round’s change.

## Next design

**Objective:** Satisfy the GOAL “InsForge hardening” checkbox by moving `eval_episodes` from documented service-key-only storage to migration-managed, RLS-hardened storage.

**Scope:**
- Add one new migration under `migrations/`.
- Update `README.md` InsForge setup/security docs.
- Optionally add a lightweight migration text test if existing test patterns make that clean.
- Do not change verifier, license, digest semantics, gym contracts, Nebius/Vapi behavior, or UI.

**Steps:**
1. Create a new InsForge migration for `public.eval_episodes`.
2. Enable RLS on `public.eval_episodes`.
3. Revoke broad direct table access from `anon` and `authenticated`.
4. Do not add permissive client read/write policies; evidence contains server-only fields and should be accessed through server endpoints.
5. Preserve the existing authoritative `trace_id` uniqueness invariant.
6. Add SQL comments documenting that server/admin writes are the only accepted write path and public clients must use `/v1` or `/api` server routes.
7. Update README to replace “service-key-only / no RLS” wording with migration + RLS setup and apply command.
8. If practical, add a focused test that checks the migration contains RLS enablement and no `USING (true)` policy on `eval_episodes`.

**Acceptance criteria:**
- `eval_episodes` schema hardening is represented as a migration.
- Direct anon/authenticated client CRUD on evidence rows is denied by privileges/RLS.
- README documents applying migrations with `npx @insforge/cli db migrations up --all`.
- No secrets are committed or exposed to the client.
- Deterministic verifier/license/digest behavior is unchanged.

**Gates:**
```bash
npm run gates
```
