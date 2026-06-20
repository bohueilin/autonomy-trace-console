import { describe, expect, it } from 'vitest'
import {
  createCaptureManifest,
  driveLinkToCaptureItem,
  fileMetaToCaptureItem,
  summarizeInputManifest,
} from './captureManifest'

describe('captureManifest', () => {
  it('stores serializable local file metadata only', () => {
    const item = fileMetaToCaptureItem({ name: 'dad-floor.mp4', type: 'video/mp4', size: 42_000_000 }, 0)
    expect(item.role).toBe('workflow_video')
    expect(item.name).toBe('dad-floor.mp4')
    expect(item.type).toBe('video/mp4')
    expect(item.size).toBe(42_000_000)
    expect(JSON.stringify(item)).not.toContain('File')
  })

  it('captures Google Drive links as declared links', () => {
    const item = driveLinkToCaptureItem('https://drive.google.com/file/demo', 1)
    expect(item?.kind).toBe('google_drive_link')
    expect(item?.role).toBe('google_drive')
    expect(item?.size).toBeNull()
  })

  it('builds a deterministic manifest summary', () => {
    const items = [
      fileMetaToCaptureItem({ name: 'floor.pdf', type: 'application/pdf', size: 1000 }, 0),
      fileMetaToCaptureItem({ name: 'unsafe-lane.png', type: 'image/png', size: 2000 }, 1),
    ]
    const manifest = createCaptureManifest({
      outcome: 'factory assistant',
      domain: 'manufacturing',
      expectedEmbodiment: 'humanoid',
      description: 'move totes',
      safetyRules: ['do not enter forklift lane'],
      items,
    })
    expect(createCaptureManifest({ ...manifest }).id).toBe(manifest.id)
    expect(summarizeInputManifest(manifest)).toContain('2 declared input')
  })
})

