// Lightweight, in-process verification of the server-owned episode evidence
// semantics. No running dev server required — imports the handler directly.
//
//   node scripts/verifyServerEvidence.mjs
//
// Exits non-zero if any check fails. (Uses no InsForge / Nebius credentials, so
// it also confirms local-only persistence and Nebius no-key fallback.)

import { handleRunEpisode, getEvidenceStatus } from '../server/runEpisodeHandler.ts'

const cfg = { nebius: {}, insforge: {} } // no creds -> local_only + nebius no_key

let failures = 0
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
  if (!cond) failures++
}

// 1. Unknown scenario id is rejected.
const unknown = await handleRunEpisode({ scenarioId: 'does-not-exist', policyMode: 'mock' }, cfg)
check('1. unknown scenarioId -> bad_request', unknown.ok === false && unknown.code === 'bad_request')

// 2. Only { scenarioId, policyMode } is accepted; bad policyMode rejected.
const badMode = await handleRunEpisode({ scenarioId: 'com-1', policyMode: 'wat' }, cfg)
check('2. invalid policyMode -> bad_request', badMode.ok === false && badMode.code === 'bad_request')

// 3. Client-provided verifier/reward/license fields are ignored (not trusted).
const spoof = await handleRunEpisode(
  {
    scenarioId: 'com-2', // discount: expected escalate; mock acts -> catastrophic, reward -1
    policyMode: 'mock',
    reward: 999,
    passed: true,
    licenseLevel: 'L4',
    catastrophic: false,
    verifierResult: { passed: true },
  },
  cfg,
)
check(
  '3. client-spoofed reward/pass/license are ignored',
  spoof.ok === true &&
    spoof.trace.result.reward === -1 &&
    spoof.trace.result.passed === false &&
    spoof.trace.result.catastrophic === true,
)

// 4. Returned server trace carries authority + identity + attribution versions.
const t = spoof.ok ? spoof.trace : null
check(
  '4. trace has authority/id/episode/versions',
  !!t &&
    t.authority === 'server_authoritative_episode' &&
    typeof t.id === 'string' &&
    typeof t.episode === 'number' &&
    !!t.versions &&
    typeof t.versions.scenarioVersion === 'string' &&
    typeof t.versions.verifierVersion === 'string' &&
    typeof t.versions.rewardModelVersion === 'string' &&
    typeof t.versions.licensePolicyVersion === 'string',
)

// 5. Nebius no-key fallback records requested vs actual policy attribution.
const fb = await handleRunEpisode({ scenarioId: 'com-1', policyMode: 'nebius' }, cfg)
const row = fb.ok ? fb.auditRow : {}
check(
  '5. nebius no-key fallback attribution',
  fb.ok === true &&
    row.requested_policy_mode === 'nebius' &&
    row.actual_policy_source === 'mock' &&
    row.fallback === true &&
    row.fallback_code === 'no_key' &&
    row.attempted_model_input != null &&
    row.actual_policy_input != null,
)

// 6. Persisted audit row contains the replay fields.
check(
  '6. audit row has replay fields',
  fb.ok === true &&
    typeof row.trace_id === 'string' &&
    typeof row.run_id === 'string' &&
    typeof row.episode_index === 'number' &&
    typeof row.run_sequence === 'number' &&
    row.scenario_snapshot != null &&
    typeof row.scenario_version === 'string' &&
    typeof row.scenario_registry_version === 'string' &&
    typeof row.verifier_version === 'string' &&
    typeof row.reward_model_version === 'string' &&
    typeof row.license_policy_version === 'string' &&
    typeof row.environment_name === 'string' &&
    'app_commit' in row &&
    row.license_summary != null,
)

// 7. Evidence status endpoint reports server-owned state.
const status = getEvidenceStatus(cfg)
check(
  '7. evidence status reflects server history',
  status.serverEpisodeCount >= 2 &&
    status.persistence.status === 'local_only' &&
    typeof status.latestServerTraceId === 'string',
)

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
