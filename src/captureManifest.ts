import type { PhysicalDomain, RobotEmbodiment } from './environmentPlan'

export const CAPTURE_ROLES = [
  'workflow_video',
  'site_photo',
  'floor_plan',
  'sop',
  'forbidden_example',
  'robot_profile',
  'google_drive',
] as const

export type CaptureRole = (typeof CAPTURE_ROLES)[number]
export type CaptureItemKind = 'local_file' | 'google_drive_link'

export interface CaptureItem {
  id: string
  kind: CaptureItemKind
  name: string
  type: string
  size: number | null
  role: CaptureRole
  source: 'local_metadata' | 'declared_link'
}

export interface CaptureManifest {
  id: string
  outcome: string
  domain: PhysicalDomain
  expectedEmbodiment: RobotEmbodiment
  description: string
  safetyRules: string[]
  items: CaptureItem[]
}

export interface SerializableFileMeta {
  name: string
  type: string
  size: number
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`
}

export function stableHash(prefix: string, value: unknown): string {
  const input = stableStringify(value)
  let h = 5381
  for (let i = 0; i < input.length; i += 1) h = ((h << 5) + h + input.charCodeAt(i)) | 0
  return `${prefix}_${(h >>> 0).toString(36)}`
}

export function inferCaptureRole(meta: Pick<SerializableFileMeta, 'name' | 'type'>): CaptureRole {
  const name = meta.name.toLowerCase()
  const type = meta.type.toLowerCase()
  if (type.startsWith('video/')) return 'workflow_video'
  if (type.startsWith('image/')) return 'site_photo'
  if (name.includes('floor') || name.includes('map') || name.includes('layout')) return 'floor_plan'
  if (name.includes('unsafe') || name.includes('forbidden') || name.includes('hazard')) return 'forbidden_example'
  if (name.includes('robot') || name.includes('hardware') || name.includes('spec')) return 'robot_profile'
  return 'sop'
}

export function fileMetaToCaptureItem(file: SerializableFileMeta, index: number): CaptureItem {
  const item = {
    kind: 'local_file' as const,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    role: inferCaptureRole(file),
    source: 'local_metadata' as const,
  }
  return { ...item, id: stableHash(`file_${index}`, item) }
}

export function driveLinkToCaptureItem(url: string, index: number): CaptureItem | null {
  const trimmed = url.trim()
  if (!trimmed) return null
  const item = {
    kind: 'google_drive_link' as const,
    name: trimmed.replace(/^https?:\/\//, '').slice(0, 80),
    type: 'text/uri-list',
    size: null,
    role: 'google_drive' as const,
    source: 'declared_link' as const,
  }
  return { ...item, id: stableHash(`drive_${index}`, item) }
}

export function createCaptureManifest(input: {
  outcome: string
  domain: PhysicalDomain
  expectedEmbodiment: RobotEmbodiment
  description: string
  safetyRules: string[]
  items: CaptureItem[]
}): CaptureManifest {
  const normalized = {
    outcome: input.outcome.trim(),
    domain: input.domain,
    expectedEmbodiment: input.expectedEmbodiment,
    description: input.description.trim(),
    safetyRules: input.safetyRules.map((r) => r.trim()).filter(Boolean),
    items: input.items.map((item) => ({ ...item })),
  }
  return { ...normalized, id: stableHash('capture', normalized) }
}

export function summarizeInputManifest(manifest: Pick<CaptureManifest, 'items' | 'safetyRules'>): string {
  const roleCounts = new Map<CaptureRole, number>()
  for (const item of manifest.items) roleCounts.set(item.role, (roleCounts.get(item.role) ?? 0) + 1)
  const roles = [...roleCounts.entries()]
    .map(([role, count]) => `${count} ${role.replaceAll('_', ' ')}`)
    .join(', ')
  const rules = manifest.safetyRules.length ? `${manifest.safetyRules.length} safety rule(s)` : 'no explicit rules'
  return `${manifest.items.length} declared input(s): ${roles || 'none'}; ${rules}.`
}

