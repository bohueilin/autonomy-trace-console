// Lightweight, in-process verification of the server-owned episode evidence
// semantics + InsForge read-back parsing. No running dev server / credentials
// required — imports the handler directly and exercises read-back with MOCKED
// InsForge rows.
//
//   node scripts/verifyServerEvidence.mjs
//
// Exits non-zero if any check fails.

import {
  handleRunEpisode,
  getEvidenceStatus,
  parseEvidenceRow,
  mergeDedupe,
  compactFromItem,
  shouldAttemptReadBack,
} from '../server/runEpisodeHandler.ts'
import { computeLicenseFromVerdicts } from '../src/license.ts'
import {
  VERIFIER_VERSION,
  REWARD_MODEL_VERSION,
  LICENSE_POLICY_VERSION,
} from '../server/evalVersions.ts'

const cfg = { nebius: {}, insforge: {} } // no creds -> local_only + nebius no_key

let failures = 0
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
  if (!cond) failures++
}

// 1. Unknown scenario id is rejected.
const unknown = await handleRunEpisode({ scenarioId: 'does-not-exist', policyMode: 'mock' }, cfg)
check('1. unknown scenarioId -> bad_request', unknown.ok === false && unknown.code === 'bad_request')

// 2. Client-provided verifier/reward/license fields are ignored (not trusted).
const spoof = await handleRunEpisode(
  { scenarioId: 'com-2', policyMode: 'mock', reward: 999, passed: true, licenseLevel: 'L4' },
  cfg,
)
check(
  '2. client-spoofed reward/pass/license ignored',
  spoof.ok === true &&
    spoof.trace.result.reward === -1 &&
    spoof.trace.result.passed === false &&
    spoof.trace.result.catastrophic === true,
)

// 3. Server traces carry authority + identity + versions.
const t = spoof.ok ? spoof.trace : null
check(
  '3. trace_authority + identity + versions',
  !!t &&
    t.authority === 'server_authoritative_episode' &&
    typeof t.id === 'string' &&
    !!t.versions &&
    typeof t.versions.verifierVersion === 'string',
)

// 4. Nebius no-key fallback attribution.
const fb = await handleRunEpisode({ scenarioId: 'com-1', policyMode: 'nebius' }, cfg)
const row = fb.ok ? fb.auditRow : {}
check(
  '4. nebius no-key fallback attribution',
  fb.ok === true &&
    row.requested_policy_mode === 'nebius' &&
    row.actual_policy_source === 'mock' &&
    row.fallback === true &&
    row.fallback_code === 'no_key' &&
    row.attempted_model_input != null &&
    row.actual_policy_input != null,
)

// --- InsForge read-back (mocked rows) -------------------------------------

const validRow = {
  trace_authority: 'server_authoritative_episode',
  id: 'rec_valid',
  trace_id: 'srv-mock-1-com-1',
  episode_index: 1,
  run_sequence: 1,
  scenario_id: 'com-1',
  scenario_title: 'Refund within policy',
  requested_policy_mode: 'mock',
  actual_policy_source: 'mock',
  fallback: false,
  fallback_code: null,
  action: 'act',
  passed: true,
  reward: 1,
  catastrophic: false,
  license_level: 'L4',
  created_at: '2026-06-19T00:00:00.000Z',
  verifier_version: VERIFIER_VERSION,
  reward_model_version: REWARD_MODEL_VERSION,
  license_policy_version: LICENSE_POLICY_VERSION,
  // server-only fields that must NOT leak through compact:
  scenario_snapshot: { hiddenRisk: 'SECRET' },
  attempted_model_input: { secret: 1 },
  actual_policy_input: { secret: 2 },
}

// 5. Read-back parses valid authoritative rows.
const parsed = parseEvidenceRow(validRow)
check(
  '5. read-back parses a valid row',
  !!parsed && parsed.traceId === 'srv-mock-1-com-1' && parsed.passed === true && parsed.versionMismatch === false,
)

// 6. Rows with wrong trace_authority are ignored.
check(
  '6. wrong trace_authority ignored',
  parseEvidenceRow({ ...validRow, trace_authority: 'demo_client_trace' }) === null,
)

// 7. Duplicate rows are not counted twice (dedupe by traceId).
const dupA = parseEvidenceRow(validRow)
const dupB = parseEvidenceRow({ ...validRow, id: 'rec_dup' }) // same trace_id
check('7. duplicate trace_id deduped', mergeDedupe([dupA], [dupB]).length === 1)

// 8. Version-mismatched rows do not corrupt the current license.
const mismatch = parseEvidenceRow({
  ...validRow,
  id: 'rec_old',
  trace_id: 'srv-mock-2-com-2',
  verifier_version: '0.0.1', // incompatible
  passed: false,
  reward: -1,
  catastrophic: true,
})
const merged = mergeDedupe([parsed], [mismatch])
const compatible = merged.filter((it) => !it.versionMismatch)
const lic = computeLicenseFromVerdicts(
  compatible.map((it) => ({ passed: it.passed, reward: it.reward, catastrophic: it.catastrophic })),
)
check(
  '8. version mismatch excluded from current license',
  mismatch.versionMismatch === true &&
    compatible.length === 1 &&
    lic.catastrophicCount === 0 &&
    lic.level.id === 'L4',
)

// 9. Compact status row exposes no snapshots / model inputs / hidden risk, and
//    DOES carry schema/digest metadata.
const compact = compactFromItem(parsed)
const keys = Object.keys(compact)
check(
  '9. compact row hides server-only fields + carries schema/digest',
  !keys.includes('scenario_snapshot') &&
    !keys.includes('attempted_model_input') &&
    !keys.includes('actual_policy_input') &&
    !JSON.stringify(compact).includes('SECRET') &&
    keys.includes('traceId') &&
    keys.includes('versionMismatch') &&
    keys.includes('rowSchemaVersion') &&
    keys.includes('digestPresent'),
)

// 10. Evidence status reflects server history (local_only, no creds).
const status = await getEvidenceStatus(cfg)
check(
  '10. evidence status (local_only, in-memory)',
  status.serverEpisodeCount >= 2 &&
    status.persistence.status === 'local_only' &&
    status.historySource === 'memory' &&
    status.rehydratedFromInsForge === false &&
    status.historyScope === 'global_recent' &&
    status.limit === 50,
)

// --- strict parse rejections (malformed dropped, not defaulted) -----------
const strip = (k) => {
  const c = { ...validRow }
  delete c[k]
  return c
}
check('11. missing scenario_title dropped', parseEvidenceRow(strip('scenario_title')) === null)
check(
  '12. unknown requested_policy_mode rejected',
  parseEvidenceRow({ ...validRow, requested_policy_mode: 'wat' }) === null,
)
check(
  '13. unknown actual_policy_source rejected',
  parseEvidenceRow({ ...validRow, actual_policy_source: 'wat' }) === null,
)
check('14. missing catastrophic rejected', parseEvidenceRow(strip('catastrophic')) === null)
check(
  '15. out-of-range / non-finite reward rejected',
  parseEvidenceRow({ ...validRow, reward: 5 }) === null &&
    parseEvidenceRow({ ...validRow, reward: Number.NaN }) === null,
)
check(
  '16. invalid created_at rejected',
  parseEvidenceRow({ ...validRow, created_at: 'not-a-date' }) === null,
)
check('17. unknown action rejected', parseEvidenceRow({ ...validRow, action: 'fly' }) === null)
check(
  '18. empty version field rejected',
  parseEvidenceRow({ ...validRow, verifier_version: '' }) === null,
)

// 19. Read-back refresh / retry gate.
const now = 1_000_000
check(
  '19. read-back gate (first/refresh/retry vs cached)',
  shouldAttemptReadBack({ everRead: false, lastErrorCode: null, lastAttemptMs: null, refresh: false, paramsChanged: false }, now) === true &&
    shouldAttemptReadBack({ everRead: true, lastErrorCode: null, lastAttemptMs: now, refresh: true, paramsChanged: false }, now) === true &&
    shouldAttemptReadBack({ everRead: true, lastErrorCode: null, lastAttemptMs: now, refresh: false, paramsChanged: false }, now) === false &&
    shouldAttemptReadBack({ everRead: true, lastErrorCode: 'unavailable', lastAttemptMs: now - 20000, refresh: false, paramsChanged: false }, now) === true &&
    shouldAttemptReadBack({ everRead: true, lastErrorCode: 'unavailable', lastAttemptMs: now - 1000, refresh: false, paramsChanged: false }, now) === false,
)

// 20. New persisted rows carry row_schema_version + audit_row_digest.
const persisted = await handleRunEpisode({ scenarioId: 'rob-1', policyMode: 'mock' }, cfg)
const prow = persisted.ok ? persisted.auditRow : {}
check(
  '20. persisted row has schema version + digest',
  typeof prow.row_schema_version === 'string' &&
    typeof prow.audit_row_digest === 'string' &&
    prow.audit_row_digest.length === 64, // sha-256 hex
)

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
