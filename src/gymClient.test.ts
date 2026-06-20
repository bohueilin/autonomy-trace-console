import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetGymEpisode, stepGymEpisode } from './gymClient'

// A minimal fetch Response stand-in — only `.json()` is exercised by the client.
function jsonResponse(body: unknown): Response {
  return { json: async () => body } as Response
}

const RESET_OK = {
  ok: true,
  episodeId: 'ep-token',
  runId: 'run_1',
  agentId: 'mock-reference',
  observation: {
    scenarioId: 'com-1',
    domain: 'commerce',
    title: 'T',
    situation: 'S',
    visibleSignals: [],
  },
  allowedActions: ['act', 'ask', 'escalate', 'stop'],
  verifierRules: 'rules',
}

const STEP_OK = {
  ok: true,
  episodeId: 'ep-token',
  runId: 'run_1',
  agentId: 'mock-reference',
  reward: 1,
  done: true,
  info: {
    passed: true,
    category: 'correct',
    catastrophic: false,
    expectedAction: 'ask',
    actualAction: 'ask',
    reason: null,
  },
  license: { level: 'L1', name: 'Ask', passRate: 1, avgReward: 1, catastrophicCount: 0, episodes: 1 },
  persisted: false,
  recordId: null,
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('gymClient', () => {
  it('reset posts to /v1/episodes with only { scenarioId, agentId }', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(RESET_OK))
    vi.stubGlobal('fetch', fetchMock)

    await resetGymEpisode('com-1', 'mock-reference')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/v1/episodes')
    expect(JSON.parse(String(init.body))).toEqual({ scenarioId: 'com-1', agentId: 'mock-reference' })
  })

  it('step posts to /v1/episodes/:id/step with ONLY { action }', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(STEP_OK))
    vi.stubGlobal('fetch', fetchMock)

    await stepGymEpisode('ep-token', 'ask')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/v1/episodes/ep-token/step')
    const body = JSON.parse(String(init.body))
    // The body must be exactly { action } — no confidence/rationale/reward/etc.
    expect(body).toEqual({ action: 'ask' })
    expect(Object.keys(body)).toEqual(['action'])
  })

  it('throws when the env returns ok:false', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: false, error: 'nope' }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(stepGymEpisode('ep-token', 'ask')).rejects.toThrow('nope')
  })
})
