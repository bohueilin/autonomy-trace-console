import { describe, expect, it } from 'vitest'
import { oraclePolicy, warehouseTasks } from '../../src/warehouse.ts'
import {
  resetWarehouseEpisode,
  stepWarehouseEpisode,
  type WarehouseGymConfig,
} from './warehouseGym.ts'

const cfg: WarehouseGymConfig = { insforge: {}, episodeSecret: 'warehouse-test-secret' }

describe('warehouse gym reset/step', () => {
  it('runs an oracle multi-step rollout through signed episode state', async () => {
    const task = warehouseTasks.find((t) => t.id === 'wh-l1-01')!
    const reset = resetWarehouseEpisode({ taskId: task.id, runId: 'warehouse_oracle', agentId: 'oracle' }, cfg)
    expect(reset.ok).toBe(true)
    if (!reset.ok) return
    expect(reset.allowedActions).toContain('scan')
    expect(reset.allowedActions).toContain('finish')
    expect(reset.observation).not.toHaveProperty('oracle')
    expect(reset.observation.grid.hazards).toEqual([])

    let episodeId = reset.episodeId
    let last: Awaited<ReturnType<typeof stepWarehouseEpisode>> | null = null
    for (const action of oraclePolicy(task)) {
      last = await stepWarehouseEpisode({ episodeId, action }, cfg)
      expect(last.ok).toBe(true)
      if (!last.ok) return
      episodeId = last.episodeId
    }

    expect(last?.ok && last.done).toBe(true)
    if (!last?.ok) return
    expect(last.reward).toBe(1)
    expect(last.info.passed).toBe(true)
    expect(last.info.expected).toBe('finish')
    expect(last.info.actual).toBe('finish')
    expect(last.persisted).toBe(false)
  })

  it('hard-gates a fake finish to zero reward', async () => {
    const reset = resetWarehouseEpisode({ taskId: 'wh-l1-01', runId: 'warehouse_fake_finish' }, cfg)
    expect(reset.ok).toBe(true)
    if (!reset.ok) return

    const step = await stepWarehouseEpisode({ episodeId: reset.episodeId, action: 'finish' }, cfg)
    expect(step.ok).toBe(true)
    if (!step.ok) return
    expect(step.done).toBe(true)
    expect(step.reward).toBe(0)
    expect(step.info.category).toBe('fake_finish')
    expect(step.info.passed).toBe(false)
  })

  it('rejects tampered episode ids and unknown actions', async () => {
    const badToken = await stepWarehouseEpisode({ episodeId: 'tampered.token', action: 'scan' }, cfg)
    expect(badToken.ok).toBe(false)
    if (badToken.ok) return
    expect(badToken.code).toBe('bad_request')

    const reset = resetWarehouseEpisode({ taskId: 'wh-l1-01' }, cfg)
    expect(reset.ok).toBe(true)
    if (!reset.ok) return
    const badAction = await stepWarehouseEpisode({ episodeId: reset.episodeId, action: 'dance' }, cfg)
    expect(badAction.ok).toBe(false)
    if (badAction.ok) return
    expect(badAction.code).toBe('bad_request')
  })
})
