## Objective

Satisfy the GOAL “CI” checkbox by adding a GitHub Actions workflow that runs the existing project gates on every pull request.

## Scope

Create/change only:
- `.github/workflows/gates.yml`

Do NOT touch:
- application code
- tests
- `package.json` / `package-lock.json`
- verifier, license, digest, evidence, gym, InsForge, scenario data, or UI files

## Steps

1. Create `.github/workflows/gates.yml`.
2. Name the workflow `gates`.
3. Configure triggers:
   - `pull_request`
   - `push` to `main`
4. Add minimal read-only permissions:
   - `contents: read`
5. Add one job, for example `gates`, running on `ubuntu-latest`.
6. Use Node 24 via `actions/setup-node`.
7. Enable npm dependency caching with `cache: npm`.
8. Install dependencies with `npm ci`.
9. Run exactly `npm run gates`.
10. Do not reference any secrets, service keys, `.env.local`, Nebius, Vapi, or InsForge credentials.

## Acceptance criteria

- `.github/workflows/gates.yml` exists.
- The workflow runs for every PR.
- The workflow also runs on pushes to `main`.
- The workflow uses `actions/checkout`, `actions/setup-node`, `npm ci`, and `npm run gates`.
- The workflow is secret-free and relies only on deterministic local/dev fallbacks.
- No files outside `.github/workflows/gates.yml` are changed.

## Gates

```bash
npm run gates
```
