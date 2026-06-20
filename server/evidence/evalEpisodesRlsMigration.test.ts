import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Text-level assertions over the RLS-hardening migration. We check posture, not a
// live database: the migration must bring `eval_episodes` under version control,
// enable RLS, deny direct client access, and avoid any permissive policy — without
// touching verifier/license/digest semantics.
const migrationUrl = new URL(
  '../../migrations/20260620090000_harden-eval-episodes-rls.sql',
  import.meta.url,
)
const sql = readFileSync(fileURLToPath(migrationUrl), 'utf8')

describe('eval_episodes RLS migration', () => {
  it('exists and is non-empty', () => {
    expect(sql.trim().length).toBeGreaterThan(0)
  })

  it('creates or manages public.eval_episodes', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.eval_episodes/)
  })

  it('enables row-level security', () => {
    expect(sql).toMatch(/ALTER TABLE public\.eval_episodes ENABLE ROW LEVEL SECURITY/)
  })

  it('revokes direct access from anon and authenticated', () => {
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.eval_episodes FROM anon, authenticated/)
  })

  it('does not add a permissive USING (true) policy', () => {
    expect(sql).not.toMatch(/USING\s*\(\s*true\s*\)/i)
    expect(sql).not.toMatch(/CREATE POLICY/i)
  })

  it('includes the integrity, schema-version, and identity columns', () => {
    expect(sql).toMatch(/audit_row_digest/)
    expect(sql).toMatch(/row_schema_version/)
    expect(sql).toMatch(/trace_id/)
  })

  it('does not modify verifier/license/digest code', () => {
    // The migration only touches the eval_episodes audit table; it must not
    // reference verifier/license/digest source modules or functions.
    expect(sql).not.toMatch(/computeAuditDigest|verifier\.ts|license\.ts|digest\.ts/)
  })
})
