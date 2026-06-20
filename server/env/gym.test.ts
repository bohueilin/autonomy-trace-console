import { describe, expect, it } from 'vitest'
import { resetEpisode, stepEpisode, type GymConfig } from './gym.ts'

// Empty InsForge credentials -> the env uses its in-memory dev fallback, so the
// tests stay deterministic and never touch the network. A fixed secret keeps
// episode tokens self-consistent across reset/step.
const cfg: GymConfig = { insforge: {}, episodeSecret: 'gym-test-secret' }

describe('resetEpisode', () => {
  it('issues an episode for a known scenarioId with a visible-only observation', () => {
    const reset = resetEpisode({ scenarioId: 'com-1' }, cfg)
    expect(reset.ok).toBe(true)
    if (!reset.ok) return
    expect(reset.episodeId.length).toBeGreaterThan(0)
    expect(reset.runId.length).toBeGreaterThan(0)
    expect(reset.agentId.length).toBeGreaterThan(0)
    expect(reset.allowedActions).toEqual(['act', 'ask', 'escalate', 'stop'])

    // Observation exposes only the visible fields; never the hidden answer.
    expect(reset.observation.scenarioId).toBe('com-1')
    expect(reset.observation.visibleSignals.length).toBeGreaterThan(0)
    expect(reset.observation).not.toHaveProperty('correctAction')
    expect(reset.observation).not.toHaveProperty('hiddenRisk')
  })

  it('rejects an unknown scenarioId', () => {
    const reset = resetEpisode({ scenarioId: 'does-not-exist' }, cfg)
    expect(reset.ok).toBe(false)
    if (reset.ok) return
    expect(reset.code).toBe('bad_request')
  })
})

describe('stepEpisode', () => {
  it('scores the correct action: reward 1, done, L4 in dev fallback', async () => {
    // Fresh runId -> the dev fallback license reflects exactly this one episode.
    const reset = resetEpisode({ scenarioId: 'com-1', runId: 'run_correct_act' }, cfg)
    expect(reset.ok).toBe(true)
    if (!reset.ok) return

    const step = await stepEpisode({ episodeId: reset.episodeId, action: 'act' }, cfg)
    expect(step.ok).toBe(true)
    if (!step.ok) return
    expect(step.done).toBe(true)
    expect(step.reward).toBe(1)
    expect(step.persisted).toBe(false)
    expect(step.info.passed).toBe(true)
    expect(step.license.level).toBe('L4')
    expect(step.license.episodes).toBe(1)
  })

  it('rejects an invalid action', async () => {
    const reset = resetEpisode({ scenarioId: 'com-1', runId: 'run_bad_action' }, cfg)
    expect(reset.ok).toBe(true)
    if (!reset.ok) return

    const step = await stepEpisode({ episodeId: reset.episodeId, action: 'fly' }, cfg)
    expect(step.ok).toBe(false)
    if (step.ok) return
    expect(step.code).toBe('bad_request')
  })

  it('rejects a tampered episodeId', async () => {
    const step = await stepEpisode({ episodeId: 'tampered.token', action: 'act' }, cfg)
    expect(step.ok).toBe(false)
    if (step.ok) return
    expect(step.code).toBe('bad_request')
  })
})
