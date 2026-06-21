import { useState } from 'react'
import { PHYSICAL_DOMAINS, ROBOT_EMBODIMENTS, getDomainTheme, getEmbodimentProfile, type PhysicalDomain, type RobotEmbodiment } from '../environmentPlan'
import { freezeWorkflow, type DescriptiveSiteMap, type ProvenanceFact, type WorkflowUnderstanding, type FrozenWorkflow } from '../workflowDraft'
import type { GridPos } from '../warehouse'

function keyOf(p: { x: number; y: number }): string {
  return `${p.x},${p.y}`
}

function has(list: readonly { x: number; y: number }[], x: number, y: number): boolean {
  return list.some((p) => p.x === x && p.y === y)
}

function without(list: readonly { x: number; y: number }[], x: number, y: number) {
  return list.filter((p) => p.x !== x || p.y !== y)
}

type Tool = 'wall' | 'hazard' | 'human' | 'robot' | 'clear'

const MAX_ROBOTS = 5

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'wall', label: 'Wall' },
  { id: 'hazard', label: 'Hazard' },
  { id: 'human', label: 'Human-only' },
  { id: 'robot', label: 'Robot' },
  { id: 'clear', label: 'Clear' },
]

function isLocked(map: DescriptiveSiteMap, x: number, y: number): boolean {
  return [map.start, map.item, map.drop].some((p) => p.x === x && p.y === y)
}

/** Remove a cell from every editable layer so a tool can claim it cleanly. */
function stripCell(map: DescriptiveSiteMap, x: number, y: number): DescriptiveSiteMap {
  return {
    ...map,
    obstacles: without(map.obstacles, x, y),
    hazards: without(map.hazards, x, y),
    humanOnly: without(map.humanOnly, x, y),
    robots: without(map.robots ?? [], x, y),
  }
}

function applyTool(map: DescriptiveSiteMap, x: number, y: number, tool: Tool): DescriptiveSiteMap {
  if (isLocked(map, x, y)) return map
  const base = stripCell(map, x, y)
  switch (tool) {
    case 'clear':
      return base
    case 'wall':
      return { ...base, obstacles: [...base.obstacles, { x, y }] }
    case 'hazard':
      return { ...base, hazards: [...base.hazards, { x, y }] }
    case 'human':
      return { ...base, humanOnly: [...base.humanOnly, { x, y }] }
    case 'robot': {
      if (has(map.robots ?? [], x, y)) return base // tap an existing robot to remove it
      if ((map.robots ?? []).length >= MAX_ROBOTS) return map
      return { ...base, robots: [...base.robots, { x, y }] }
    }
    default:
      return base
  }
}

function robotIndex(map: DescriptiveSiteMap, x: number, y: number): number {
  return (map.robots ?? []).findIndex((p) => p.x === x && p.y === y)
}

function cellKind(map: DescriptiveSiteMap, x: number, y: number): string {
  if (map.start.x === x && map.start.y === y) return 'S'
  if (map.item.x === x && map.item.y === y) return 'I'
  if (map.drop.x === x && map.drop.y === y) return 'D'
  if (robotIndex(map, x, y) >= 0) return 'robot'
  if (has(map.obstacles, x, y)) return 'wall'
  if (has(map.hazards, x, y)) return 'hazard'
  if (has(map.humanOnly, x, y)) return 'human'
  return 'clear'
}

function cellText(map: DescriptiveSiteMap, x: number, y: number): string {
  const kind = cellKind(map, x, y)
  if (kind === 'S' || kind === 'I' || kind === 'D') return kind
  if (kind === 'robot') return `R${robotIndex(map, x, y) + 1}`
  if (kind === 'wall') return 'W'
  if (kind === 'hazard') return '!'
  if (kind === 'human') return 'H'
  return ''
}

function firstFreeCell(map: DescriptiveSiteMap): GridPos | null {
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!isLocked(map, x, y) && cellKind(map, x, y) === 'clear') return { x, y }
    }
  }
  return null
}

function FactEditor({
  title,
  facts,
  onChange,
}: {
  title: string
  facts: ProvenanceFact[]
  onChange: (facts: ProvenanceFact[]) => void
}) {
  return (
    <div className="align-panel">
      <div className="panel-kicker">{title}</div>
      {facts.map((fact, index) => (
        <label className="fact-row" key={fact.id}>
          <span className={`prov-chip prov-${fact.state}`}>{fact.state.replace('_', '-')}</span>
          <textarea
            value={fact.text}
            rows={2}
            onChange={(e) =>
              onChange(facts.map((f, i) => (i === index ? { ...f, text: e.target.value, state: 'edited' } : f)))
            }
          />
        </label>
      ))}
    </div>
  )
}

export function ReflectAlign({
  draft,
  onApprove,
  onBack,
}: {
  draft: WorkflowUnderstanding
  onApprove: (frozen: FrozenWorkflow) => void
  onBack: () => void
}) {
  const [domain, setDomain] = useState<PhysicalDomain>(draft.domain)
  const [embodiment, setEmbodiment] = useState<RobotEmbodiment>(draft.embodiment)
  const [siteMap, setSiteMap] = useState<DescriptiveSiteMap>(draft.siteMap)
  const [tool, setTool] = useState<Tool>('wall')
  const [storyboard, setStoryboard] = useState(draft.storyboard)
  const [finishRules, setFinishRules] = useState(draft.finishRules)
  const [escalateRules, setEscalateRules] = useState(draft.escalateRules)
  const [refuseRules, setRefuseRules] = useState(draft.refuseRules)

  function approve() {
    onApprove(
      freezeWorkflow({
        ...draft,
        domain,
        embodiment,
        siteMap,
        storyboard,
        finishRules,
        escalateRules,
        refuseRules,
      }),
    )
  }

  return (
    <section className="reflect">
      <div className="flow-shell wide">
        <button className="btn ghost back" onClick={onBack}>
          ← Back to capture
        </button>
        <div className="flow-kicker">Reflect back & align</div>
        <h1>Does this match the real workflow?</h1>
        <p className="flow-sub">
          This is an editable interpretation. The deterministic oracle scores only after you freeze
          the approved workflow.
        </p>

        <div className="trust-banner">
          <span>AI-proposed</span>
          <span>Editable until confirmed</span>
          <span>Scored later by deterministic oracle</span>
        </div>

        <div className="align-grid">
          <div className="align-panel site-map-panel">
            <div className="panel-kicker">Descriptive site map</div>
            <p>
              Pick a tool, then tap cells to plan the site and place robots. This expresses
              deployment intent and drives the illustration — it never changes scored physics.
            </p>

            <div className="map-palette" role="group" aria-label="Site map placement tool">
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  className={`tool-btn tool-${t.id} ${tool === t.id ? 'on' : ''}`}
                  aria-pressed={tool === t.id}
                  onClick={() => setTool(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="robot-controls">
              <span className="robot-count">
                Intended deployment: <strong>{(siteMap.robots ?? []).length}</strong> robot
                {(siteMap.robots ?? []).length === 1 ? '' : 's'}
              </span>
              <div className="robot-buttons">
                <button
                  className="btn ghost"
                  disabled={(siteMap.robots ?? []).length >= MAX_ROBOTS}
                  onClick={() =>
                    setSiteMap((m) => {
                      const free = firstFreeCell(m)
                      return free ? applyTool(m, free.x, free.y, 'robot') : m
                    })
                  }
                >
                  + Add robot
                </button>
                <button
                  className="btn ghost"
                  disabled={(siteMap.robots ?? []).length === 0}
                  onClick={() => setSiteMap((m) => ({ ...m, robots: (m.robots ?? []).slice(0, -1) }))}
                >
                  Remove robot
                </button>
              </div>
            </div>

            <div className="site-grid" style={{ gridTemplateColumns: `repeat(${siteMap.width}, 1fr)` }}>
              {Array.from({ length: siteMap.width * siteMap.height }, (_, i) => {
                const x = i % siteMap.width
                const y = Math.floor(i / siteMap.width)
                const kind = cellKind(siteMap, x, y)
                const text = cellText(siteMap, x, y)
                return (
                  <button
                    key={keyOf({ x, y })}
                    className={`site-cell cell-${kind}`}
                    onClick={() => setSiteMap((m) => applyTool(m, x, y, tool))}
                    aria-label={`Cell ${x},${y} ${kind}${text ? ` ${text}` : ''}`}
                  >
                    {text}
                  </button>
                )
              })}
            </div>

            <div className="site-legend">
              <span className="lg-sid">S Start</span>
              <span className="lg-sid">I Item</span>
              <span className="lg-sid">D Drop</span>
              <span className="lg-robot">R Robot</span>
              <span className="lg-hazard">! Hazard</span>
              <span className="lg-human">H Human-only</span>
              <span className="lg-wall">W Wall</span>
            </div>
          </div>

          <div className="align-panel">
            <div className="panel-kicker">Confirmed robot context</div>
            <label className="field">
              <span className="field-label">Domain</span>
              <select className="field-input" value={domain} onChange={(e) => setDomain(e.target.value as PhysicalDomain)}>
                {PHYSICAL_DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {getDomainTheme(d).label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Robot embodiment</span>
              <select
                className="field-input"
                value={embodiment}
                onChange={(e) => setEmbodiment(e.target.value as RobotEmbodiment)}
              >
                {ROBOT_EMBODIMENTS.map((e) => (
                  <option key={e} value={e}>
                    {getEmbodimentProfile(e).label}
                  </option>
                ))}
              </select>
            </label>
            <p className="field-hint">{getEmbodimentProfile(embodiment).note}</p>
          </div>

          <FactEditor title="Task storyboard" facts={storyboard} onChange={setStoryboard} />
          <FactEditor title="Finish rules" facts={finishRules} onChange={setFinishRules} />
          <FactEditor title="Escalate rules" facts={escalateRules} onChange={setEscalateRules} />
          <FactEditor title="Refuse rules" facts={refuseRules} onChange={setRefuseRules} />
        </div>

        <div className="flow-actions">
          <button className="btn primary hero-action" onClick={approve}>
            Approve workflow
          </button>
          <span className="trust-note">Approval freezes a snapshot; scoring still comes from BFS oracle.</span>
        </div>
      </div>
    </section>
  )
}

