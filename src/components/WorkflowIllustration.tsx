import { useEffect, useMemo, useState } from 'react'
import type { EnvironmentPlan } from '../environmentPlan'
import type { FrozenWorkflow } from '../workflowDraft'
import { WORKFLOW_ACTION_LABELS } from '../workflowDraft'
import { applyWarehouseAction, bfsOracle, initialWarehouseState, oraclePolicy, type GridPos, type WarehouseTask } from '../warehouse'

function posKey(p: GridPos): string {
  return `${p.x},${p.y}`
}

function positionsFor(task: WarehouseTask): GridPos[] {
  let state = initialWarehouseState(task)
  const positions = [state.position]
  for (const action of oraclePolicy(task)) {
    state = applyWarehouseAction(task, state, action)
    positions.push(state.position)
    if (state.terminalAction || state.unsafeEntered) break
  }
  return positions
}

export function WorkflowIllustration({
  plan,
  frozen,
  onFreeze,
  onBack,
}: {
  plan: EnvironmentPlan
  frozen: FrozenWorkflow
  onFreeze: () => void
  onBack: () => void
}) {
  const task = plan.tasks.find((t) => bfsOracle(t).label === 'finish') ?? plan.tasks[0]
  const oracle = bfsOracle(task)
  const actions = oraclePolicy(task)
  const path = useMemo(() => positionsFor(task), [task])
  const [step, setStep] = useState(0)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    const timer = window.setInterval(() => {
      setStep((s) => (s >= actions.length ? actions.length : s + 1))
    }, 420)
    return () => window.clearInterval(timer)
  }, [actions.length])

  const current = path[Math.min(step, path.length - 1)] ?? task.start
  const pathSet = new Set(path.slice(0, Math.min(step + 1, path.length)).map(posKey))

  return (
    <section className="illustrate">
      <div className="flow-shell wide">
        <button className="btn ghost back" onClick={onBack}>
          ← Back to approval
        </button>
        <div className="flow-kicker">Illustrate</div>
        <h1>Watch the frozen workflow become a deterministic eval.</h1>
        <p className="flow-sub">
          This animation is an illustration of your approved workflow. The actual score still comes
          from the symbolic oracle and verifier.
        </p>

        <div className="illustration-grid">
          <div className="simulation-stage">
            <div className="stage-caption">
              <span>Representative task</span>
              <strong>{task.title}</strong>
            </div>
            <div className="sim-grid" style={{ gridTemplateColumns: `repeat(${task.width}, 1fr)` }}>
              {Array.from({ length: task.width * task.height }, (_, i) => {
                const x = i % task.width
                const y = Math.floor(i / task.width)
                const key = `${x},${y}`
                const isRobot = current.x === x && current.y === y
                const label =
                  task.start.x === x && task.start.y === y
                    ? 'S'
                    : task.item.x === x && task.item.y === y
                      ? 'I'
                      : task.drop.x === x && task.drop.y === y
                        ? 'D'
                        : task.hazards.some((p) => p.x === x && p.y === y)
                          ? '!'
                          : task.humanOnly.some((p) => p.x === x && p.y === y)
                            ? 'H'
                            : ''
                return (
                  <div
                    className={`sim-cell ${pathSet.has(key) ? 'path' : ''} ${isRobot ? 'robot' : ''}`}
                    key={key}
                  >
                    {isRobot ? '●' : label}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="simulation-copy">
            <div className="panel-kicker">Why this matters</div>
            <h2>{oracle.label.toUpperCase()}</h2>
            <p>{oracle.reason}</p>
            <div className="action-timeline">
              {actions.map((action, index) => (
                <button
                  key={`${action}-${index}`}
                  className={index <= step ? 'on' : ''}
                  onClick={() => setStep(index + 1)}
                >
                  {WORKFLOW_ACTION_LABELS[action]}
                </button>
              ))}
            </div>
            <div className="frozen-card">
              <span>Confirmed by you</span>
              <strong>{frozen.approvedFactsHash}</strong>
              <p>{frozen.frozenWorkflowSummary}</p>
            </div>
          </div>
        </div>

        <div className="flow-actions">
          <button className="btn primary hero-action" onClick={onFreeze}>
            Freeze eval
          </button>
          <span className="trust-note">After freeze, authoring cannot silently mutate scored tasks.</span>
        </div>
      </div>
    </section>
  )
}

