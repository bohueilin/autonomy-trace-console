import { describe, expect, it } from 'vitest'
import { computeAuditDigest, parseEvidenceRow } from './runEpisodeHandler.ts'
import {
  LICENSE_POLICY_VERSION,
  REWARD_MODEL_VERSION,
  VERIFIER_VERSION,
} from './evalVersions.ts'

// A minimal but valid, current-schema, server-authoritative evidence row. The
// gym /v1 path persists rows with `external` provenance; the unified evidence
// schema must accept them while still rejecting unknown provenance values.
const baseRow: Record<string, unknown> = {
  trace_authority: 'server_authoritative_episode',
  id: 'rec_x',
  trace_id: 'srv-mock-1-com-1',
  run_id: 'run_x',
  episode_index: 1,
  run_sequence: 1,
  scenario_id: 'com-1',
  scenario_title: 'Refund within policy',
  requested_policy_mode: 'mock',
  actual_policy_source: 'mock',
  fallback: false,
  fallback_code: null,
  model_name: null,
  action: 'act',
  rationale: 'looks routine',
  requested_info: '',
  confidence: 0.9,
  passed: true,
  reward: 1,
  category: 'correct',
  catastrophic: false,
  expected_action: 'act',
  actual_action: 'act',
  verifier_reason: null,
  verifier_checks: [],
  license_level: 'L4',
  created_at: '2026-06-20T00:00:00.000Z',
  verifier_version: VERIFIER_VERSION,
  reward_model_version: REWARD_MODEL_VERSION,
  license_policy_version: LICENSE_POLICY_VERSION,
  row_schema_version: '1.0.0',
}

const digested = (row: Record<string, unknown>) => ({
  ...row,
  audit_row_digest: computeAuditDigest(row),
})

describe('parseEvidenceRow — unified evidence schema', () => {
  it('accepts a digest-valid gym row with external provenance', () => {
    const externalRow = {
      ...baseRow,
      trace_id: 'gym-ep_2026-06-20-com-1-1',
      requested_policy_mode: 'external',
      actual_policy_source: 'external',
      model_name: 'external-agent/reference-v1',
    }
    const item = parseEvidenceRow(digested(externalRow))
    expect(item).not.toBeNull()
    expect(item?.requestedPolicyMode).toBe('external')
    expect(item?.actualPolicySource).toBe('external')
    expect(item?.digestStatus).toBe('valid')
    expect(item?.versionMismatch).toBe(false)
  })

  it('still accepts legacy mock/nebius provenance', () => {
    expect(parseEvidenceRow(digested(baseRow))?.actualPolicySource).toBe('mock')
    expect(
      parseEvidenceRow(digested({ ...baseRow, requested_policy_mode: 'nebius' }))
        ?.requestedPolicyMode,
    ).toBe('nebius')
  })

  it('rejects unknown provenance values', () => {
    expect(parseEvidenceRow({ ...baseRow, requested_policy_mode: 'wat' })).toBeNull()
    expect(parseEvidenceRow({ ...baseRow, actual_policy_source: 'rogue' })).toBeNull()
  })
})
