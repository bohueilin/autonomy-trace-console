## Objective
Make `/v1` reset/step the primary single-episode UI/reference-agent path, satisfying the GOAL “Gym is canonical” checkbox.

## Scope
Change only:
- `src/serverEpisodeClient.ts` or a new `src/gymClient.ts`
- `src/App.tsx`
- `src/types.ts`
- `README.md`

Do NOT touch:
- `server/env/gym.ts`
- `server/main.ts`
- verifier, reward, license semantics
- scenario contents
- digest/evidence parsing or InsForge persistence
- Vapi handlers
- `/api/run-episode` server behavior

## Steps
1. Add frontend client support for:
   - `POST /v1/episodes`
   - `POST /v1/episodes/:episodeId/step`

2. The reset request must send only:
   - `scenarioId`
   - `agentId` derived from selected mode, e.g. `mock-reference` or `nebius-reference`

3. The step request must send only:
   - `{ action }`

   Do not send confidence, rationale, reward, verifier result, expected action, catastrophic, license, scenario answer, or hidden fields.

4. Replace the primary single-episode button path in `src/App.tsx` so it:
   - calls `/v1/episodes`
   - asks the selected reference agent for an action from the returned observation
   - calls `/v1/episodes/:episodeId/step`
   - renders the `/v1` step result as the authoritative trace

5. Reference-agent behavior:
   - For Nebius, map the reset observation to `ModelPolicyView` and call the existing `/api/nebius-action` client only to obtain an action.
   - For mock, keep using the existing mock policy, but only as the action proposer. The environment remains the verifier/license authority.
   - If Nebius fails, fall back to mock for action proposal and show the existing notice.

6. Build the displayed `Trace` from the `/v1` step result:
   - `authority: 'server_authoritative_episode'`
   - `provenance.requestedPolicyMode`: selected mode
   - `provenance.actualPolicySource`: `nebius` when Nebius returned an action, otherwise `mock`
   - `result.reward`, `passed`, `category`, `catastrophic`, `expectedAction`, and chosen action from `/v1` step response
   - `licenseSignal` derived from the `/v1` verifier result, not local verification

7. Make the UI visibly canonical:
   - Primary button should run the `/v1` gym episode.
   - Remove or demote the separate “Run Server Episode” button that calls `/api/run-episode`.
   - Leave `/api/evidence/status` usage intact for the Evidence panel.

8. Update README wording:
   - Replace “server-owned flow (`POST /api/run-episode`)" as the primary path with `/v1` reset/step.
   - Fix the top summary that still says InsForge read-back/rehydration is deferred.
   - Make clear `/api/run-episode` is legacy compatibility, not the canonical gym path.

9. Add a focused Vitest test if new mapping logic is non-trivial. At minimum, cover that the gym client step body contains only `{ action }`.

## Acceptance criteria
- Clicking the primary single-episode button results in one `POST /v1/episodes` and one `POST /v1/episodes/:episodeId/step`.
- The step request body contains only `{ action }`.
- The primary UI trace is tagged `server_authoritative_episode`.
- The browser no longer computes verifier/license for the primary single-episode path.
- `/api/run-episode` is not presented as the canonical episode path.
- README no longer claims InsForge read-back/rehydration is deferred.
- Existing evidence/digest/fail-closed behavior remains unchanged.

## Gates
```bash
npm run build
npm run lint
npm run verify:evidence
npm test
npm run gates
```
