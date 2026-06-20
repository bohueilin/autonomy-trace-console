import { describe, expect, it } from 'vitest'
import { createApp } from './app.ts'
import type { AppConfig } from './config.ts'

// A test config with NO InsForge creds (in-memory dev fallback) and NO Nebius key
// (the Nebius reference path always falls back to mock). A fixed episode secret
// keeps tokens self-consistent. The app is exercised with `app.request(...)` so no
// port is bound and no network is touched.
const config: AppConfig = {
  port: 0,
  isProd: false,
  nebius: {},
  insforge: {},
  episodeSecret: 'app-test-secret',
  warnings: [],
}

const app = createApp(config)

async function post(path: string, body: unknown): Promise<Response> {
  return app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('createApp /v1 trust boundary', () => {
  it('PUBLIC reset rejects reserved reference-agent ids', async () => {
    for (const agentId of ['mock-reference', 'nebius-reference']) {
      const resp = await post('/v1/episodes', { scenarioId: 'com-1', agentId })
      expect(resp.status).toBe(400)
      const body = (await resp.json()) as { ok: boolean }
      expect(body.ok).toBe(false)
    }
  })

  it('PUBLIC reset accepts a normal external agentId', async () => {
    const resp = await post('/v1/episodes', { scenarioId: 'com-1', agentId: 'rl-trainer-7' })
    expect(resp.status).toBe(200)
    const body = (await resp.json()) as { ok: boolean; agentId: string; episodeId: string }
    expect(body.ok).toBe(true)
    expect(body.agentId).toBe('rl-trainer-7')
    expect(body.episodeId.length).toBeGreaterThan(0)
  })

  it('step accepts EXACTLY { action } and rejects extra fields', async () => {
    const reset = (await (
      await post('/v1/episodes', { scenarioId: 'com-1', agentId: 'rl-trainer-7' })
    ).json()) as { episodeId: string }

    // Extra digest-covered fields are rejected at the HTTP boundary.
    for (const extra of [
      { action: 'act', confidence: 1 },
      { action: 'act', rationale: 'forged' },
      { action: 'act', reward: 999 },
      { action: 'act', license: 'L4' },
      { action: 'act', passed: true },
      { action: 'act', episodeId: 'override' },
    ]) {
      const resp = await post(`/v1/episodes/${reset.episodeId}/step`, extra)
      expect(resp.status).toBe(400)
      const body = (await resp.json()) as { ok: boolean; code: string }
      expect(body.ok).toBe(false)
      expect(body.code).toBe('bad_request')
    }

    // The exact { action } body is accepted and scored by the env.
    const ok = await post(`/v1/episodes/${reset.episodeId}/step`, { action: 'act' })
    expect(ok.status).toBe(200)
    const okBody = (await ok.json()) as { ok: boolean; done: boolean }
    expect(okBody.ok).toBe(true)
    expect(okBody.done).toBe(true)
  })

  it('POST /v1/step enforces EXACTLY { episodeId, action }', async () => {
    const reset = (await (
      await post('/v1/episodes', { scenarioId: 'com-1', agentId: 'rl-trainer-7' })
    ).json()) as { episodeId: string }

    const bad = await post('/v1/step', { episodeId: reset.episodeId, action: 'act', confidence: 0.9 })
    expect(bad.status).toBe(400)
    expect(((await bad.json()) as { code: string }).code).toBe('bad_request')

    const ok = await post('/v1/step', { episodeId: reset.episodeId, action: 'act' })
    expect(ok.status).toBe(200)
    expect(((await ok.json()) as { ok: boolean }).ok).toBe(true)
  })
})

describe('createApp /v1/reference-episodes (server-owned reference agents)', () => {
  it('mock mode runs an episode and reports mock/mock provenance', async () => {
    const resp = await post('/v1/reference-episodes', { scenarioId: 'com-1', mode: 'mock' })
    expect(resp.status).toBe(200)
    const body = (await resp.json()) as {
      ok: boolean
      step: { done: boolean; license: { episodes: number } }
      decision: { source: string }
      provenance: { requestedPolicyMode: string; actualPolicySource: string; fallback: boolean }
    }
    expect(body.ok).toBe(true)
    expect(body.step.done).toBe(true)
    expect(body.step.license.episodes).toBe(1)
    expect(body.decision.source).toBe('mock')
    expect(body.provenance.requestedPolicyMode).toBe('mock')
    expect(body.provenance.actualPolicySource).toBe('mock')
    expect(body.provenance.fallback).toBe(false)
  })

  it('nebius mode with no key falls back to a fresh mock episode (never steps nebius)', async () => {
    const resp = await post('/v1/reference-episodes', { scenarioId: 'com-1', mode: 'nebius' })
    expect(resp.status).toBe(200)
    const body = (await resp.json()) as {
      ok: boolean
      decision: { source: string }
      provenance: { requestedPolicyMode: string; actualPolicySource: string; fallback: boolean; fallbackCode: string | null }
    }
    expect(body.ok).toBe(true)
    // The model could not propose, so the fallback mock episode is what ran.
    expect(body.decision.source).toBe('mock')
    expect(body.provenance.requestedPolicyMode).toBe('nebius')
    expect(body.provenance.actualPolicySource).toBe('mock')
    expect(body.provenance.fallback).toBe(true)
    expect(body.provenance.fallbackCode).toBe('nebius_unavailable')
  })

  it('rejects an unknown mode', async () => {
    const resp = await post('/v1/reference-episodes', { scenarioId: 'com-1', mode: 'gpt' })
    expect(resp.status).toBe(400)
    expect(((await resp.json()) as { ok: boolean }).ok).toBe(false)
  })

  it('rejects extra fields', async () => {
    const resp = await post('/v1/reference-episodes', { scenarioId: 'com-1', mode: 'mock', agentId: 'nebius-reference' })
    expect(resp.status).toBe(400)
    expect(((await resp.json()) as { code: string }).code).toBe('bad_request')
  })

  it('rejects an unknown scenarioId', async () => {
    const resp = await post('/v1/reference-episodes', { scenarioId: 'nope', mode: 'mock' })
    expect(resp.status).toBe(400)
    expect(((await resp.json()) as { ok: boolean }).ok).toBe(false)
  })
})
