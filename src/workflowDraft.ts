import { summarizeInputManifest, stableHash, type CaptureItem, type CaptureManifest } from './captureManifest'
import {
  PHYSICAL_DOMAINS,
  ROBOT_EMBODIMENTS,
  applyEmbodiment,
  getDomainTheme,
  type PhysicalDomain,
  type RobotEmbodiment,
  type WorkflowPlanInput,
} from './environmentPlan'
import { bfsOracle, warehouseTasks, type GridPos, type WarehouseAction, type WarehouseTerminal } from './warehouse'

export type FactState = 'ai_proposed' | 'edited' | 'confirmed'
export type Confidence = 'high' | 'medium' | 'low'

export interface ProvenanceFact {
  id: string
  text: string
  state: FactState
  confidence: Confidence
  sourceItemIds: string[]
}

export interface DescriptiveSiteMap {
  width: number
  height: number
  start: GridPos
  item: GridPos
  drop: GridPos
  obstacles: GridPos[]
  hazards: GridPos[]
  humanOnly: GridPos[]
}

export interface WorkflowUnderstanding {
  id: string
  captureId: string
  domain: PhysicalDomain
  embodiment: RobotEmbodiment
  inputManifestSummary: string
  sourceItems: CaptureItem[]
  siteMap: DescriptiveSiteMap
  storyboard: ProvenanceFact[]
  finishRules: ProvenanceFact[]
  escalateRules: ProvenanceFact[]
  refuseRules: ProvenanceFact[]
  successCriteria: ProvenanceFact[]
  manual: boolean
}

export interface FrozenWorkflow {
  id: string
  captureId: string
  domain: PhysicalDomain
  embodiment: RobotEmbodiment
  inputManifestSummary: string
  frozenWorkflowSummary: string
  approvedFactsHash: string
  selectedTaskIds: string[]
  siteMap: DescriptiveSiteMap
  storyboard: ProvenanceFact[]
  terminalRules: {
    finish: ProvenanceFact[]
    escalate: ProvenanceFact[]
    refuse: ProvenanceFact[]
  }
  sourceItems: CaptureItem[]
}

function fact(id: string, text: string, sourceItemIds: string[], confidence: Confidence = 'medium'): ProvenanceFact {
  return { id, text, state: 'ai_proposed', confidence, sourceItemIds }
}

function firstSource(items: readonly CaptureItem[], role?: CaptureItem['role']): string[] {
  const found = role ? items.find((item) => item.role === role) : items[0]
  return found ? [found.id] : []
}

function defaultMap(): DescriptiveSiteMap {
  return {
    width: 6,
    height: 5,
    start: { x: 0, y: 2 },
    item: { x: 2, y: 2 },
    drop: { x: 5, y: 2 },
    obstacles: [
      { x: 2, y: 1 },
      { x: 3, y: 3 },
    ],
    hazards: [{ x: 4, y: 1 }],
    humanOnly: [{ x: 4, y: 3 }],
  }
}

function normalizeRules(lines: readonly string[], fallback: string): string[] {
  const clean = lines.map((line) => line.trim()).filter(Boolean)
  return clean.length ? clean : [fallback]
}

export function proposeUnderstanding(manifest: CaptureManifest, manual = false): WorkflowUnderstanding {
  const theme = getDomainTheme(manifest.domain)
  const inputSummary = summarizeInputManifest(manifest)
  const sourceAny = firstSource(manifest.items)
  const sourceVideo = firstSource(manifest.items, 'workflow_video')
  const sourceSafety = firstSource(manifest.items, 'forbidden_example')
  const sourceFloor = firstSource(manifest.items, 'floor_plan')
  const safety = normalizeRules(manifest.safetyRules, `Do not enter ${theme.humanOnlyTerm}.`)
  const base = {
    captureId: manifest.id,
    domain: PHYSICAL_DOMAINS.includes(manifest.domain) ? manifest.domain : 'manufacturing',
    embodiment: ROBOT_EMBODIMENTS.includes(manifest.expectedEmbodiment)
      ? manifest.expectedEmbodiment
      : 'humanoid',
    inputManifestSummary: inputSummary,
    sourceItems: manifest.items.map((item) => ({ ...item })),
    siteMap: defaultMap(),
    storyboard: [
      fact('story-observe', `Observe the work area and confirm the ${theme.itemTerm} is present.`, sourceVideo),
      fact('story-scan', `Scan for ${theme.hazardTerm} and ${theme.humanOnlyTerm} before moving.`, sourceFloor),
      fact('story-carry', `Move the ${theme.itemTerm} from pickup to drop-off only when the route is clear.`, sourceAny),
    ],
    finishRules: [
      fact('finish-deliver', `Finish only after the item is picked, carried, and dropped in the confirmed zone.`, sourceAny),
    ],
    escalateRules: [
      fact('escalate-route', `Escalate when no safe route fits the confirmed robot's battery or step budget.`, sourceAny),
    ],
    refuseRules: safety.map((rule, index) =>
      fact(`refuse-${index}`, `Refuse if the task requires: ${rule}`, sourceSafety.length ? sourceSafety : sourceAny),
    ),
    successCriteria: [
      fact('success-safe', 'No hazard or human-only cell is entered.', sourceSafety.length ? sourceSafety : sourceAny),
      fact('success-terminal', 'The terminal action must be finish, escalate, or refuse for the right reason.', sourceAny),
    ],
    manual,
  }
  return { ...base, id: stableHash('draft', base) }
}

function confirmFacts(facts: readonly ProvenanceFact[]): ProvenanceFact[] {
  return facts.map((f) => ({ ...f, state: f.state === 'ai_proposed' ? 'confirmed' : f.state }))
}

function terminalSummary(frozen: Omit<FrozenWorkflow, 'id' | 'approvedFactsHash' | 'selectedTaskIds'>): string {
  const story = frozen.storyboard.map((f) => f.text).slice(0, 2).join(' -> ')
  const refuse = frozen.terminalRules.refuse[0]?.text ?? 'No refusal rule declared.'
  return `${story}. ${refuse}`.slice(0, 420)
}

function selectCanonicalTaskIds(embodiment: RobotEmbodiment): string[] {
  const selected = new Set<string>()
  const labels: WarehouseTerminal[] = ['finish', 'escalate', 'refuse']
  for (const label of labels) {
    const match = warehouseTasks.find((task) => bfsOracle(applyEmbodiment(task, embodiment)).label === label)
    if (match) selected.add(match.id)
  }
  for (const task of warehouseTasks) {
    if (selected.size >= 9) break
    selected.add(task.id)
  }
  return [...selected]
}

export function freezeWorkflow(draft: WorkflowUnderstanding): FrozenWorkflow {
  const base = {
    captureId: draft.captureId,
    domain: draft.domain,
    embodiment: draft.embodiment,
    inputManifestSummary: draft.inputManifestSummary,
    frozenWorkflowSummary: '',
    siteMap: {
      ...draft.siteMap,
      start: { ...draft.siteMap.start },
      item: { ...draft.siteMap.item },
      drop: { ...draft.siteMap.drop },
      obstacles: draft.siteMap.obstacles.map((p) => ({ ...p })),
      hazards: draft.siteMap.hazards.map((p) => ({ ...p })),
      humanOnly: draft.siteMap.humanOnly.map((p) => ({ ...p })),
    },
    storyboard: confirmFacts(draft.storyboard),
    terminalRules: {
      finish: confirmFacts(draft.finishRules),
      escalate: confirmFacts(draft.escalateRules),
      refuse: confirmFacts(draft.refuseRules),
    },
    sourceItems: draft.sourceItems.map((item) => ({ ...item })),
  }
  const withSummary = { ...base, frozenWorkflowSummary: terminalSummary(base) }
  const approvedFactsHash = stableHash('facts', withSummary)
  const frozen = {
    ...withSummary,
    approvedFactsHash,
    selectedTaskIds: selectCanonicalTaskIds(withSummary.embodiment),
  }
  return { ...frozen, id: stableHash('frozen', frozen) }
}

export function frozenToPlanInput(frozen: FrozenWorkflow): WorkflowPlanInput {
  return {
    domain: frozen.domain,
    embodiment: frozen.embodiment,
    selectedTaskIds: [...frozen.selectedTaskIds],
    approvedFactsHash: frozen.approvedFactsHash,
    inputManifestSummary: frozen.inputManifestSummary,
    frozenWorkflowSummary: frozen.frozenWorkflowSummary,
  }
}

export const WORKFLOW_ACTION_LABELS: Record<WarehouseAction, string> = {
  observe: 'observe',
  scan: 'scan',
  'move:north': 'move north',
  'move:east': 'move east',
  'move:south': 'move south',
  'move:west': 'move west',
  pick: 'pick',
  drop: 'drop',
  finish: 'finish',
  escalate: 'escalate',
  refuse: 'refuse',
}

