import { useState } from 'react'
import { PHYSICAL_DOMAINS, ROBOT_EMBODIMENTS, getDomainTheme, getEmbodimentProfile, type PhysicalDomain, type RobotEmbodiment } from '../environmentPlan'
import { freezeWorkflow, type DescriptiveSiteMap, type ProvenanceFact, type WorkflowUnderstanding, type FrozenWorkflow } from '../workflowDraft'

function keyOf(p: { x: number; y: number }): string {
  return `${p.x},${p.y}`
}

function has(list: readonly { x: number; y: number }[], x: number, y: number): boolean {
  return list.some((p) => p.x === x && p.y === y)
}

function without(list: readonly { x: number; y: number }[], x: number, y: number) {
  return list.filter((p) => p.x !== x || p.y !== y)
}

function toggleCell(map: DescriptiveSiteMap, x: number, y: number): DescriptiveSiteMap {
  const locked = [map.start, map.item, map.drop].some((p) => p.x === x && p.y === y)
  if (locked) return map
  if (has(map.obstacles, x, y)) {
    return { ...map, obstacles: without(map.obstacles, x, y), hazards: [...map.hazards, { x, y }] }
  }
  if (has(map.hazards, x, y)) {
    return { ...map, hazards: without(map.hazards, x, y), humanOnly: [...map.humanOnly, { x, y }] }
  }
  if (has(map.humanOnly, x, y)) {
    return { ...map, humanOnly: without(map.humanOnly, x, y) }
  }
  return { ...map, obstacles: [...map.obstacles, { x, y }] }
}

function cellLabel(map: DescriptiveSiteMap, x: number, y: number): string {
  if (map.start.x === x && map.start.y === y) return 'S'
  if (map.item.x === x && map.item.y === y) return 'I'
  if (map.drop.x === x && map.drop.y === y) return 'D'
  if (has(map.obstacles, x, y)) return 'wall'
  if (has(map.hazards, x, y)) return 'hazard'
  if (has(map.humanOnly, x, y)) return 'human'
  return ''
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
            <p>Tap cells to cycle wall → hazard → human-only → clear. This drives illustration, not scored physics.</p>
            <div className="site-grid" style={{ gridTemplateColumns: `repeat(${siteMap.width}, 1fr)` }}>
              {Array.from({ length: siteMap.width * siteMap.height }, (_, i) => {
                const x = i % siteMap.width
                const y = Math.floor(i / siteMap.width)
                const label = cellLabel(siteMap, x, y)
                return (
                  <button
                    key={keyOf({ x, y })}
                    className={`site-cell cell-${label || 'clear'}`}
                    onClick={() => setSiteMap((m) => toggleCell(m, x, y))}
                    aria-label={`Cell ${x},${y} ${label || 'clear'}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <div className="site-legend">
              <span>S start</span>
              <span>I item</span>
              <span>D drop</span>
              <span>hazard</span>
              <span>human-only</span>
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

