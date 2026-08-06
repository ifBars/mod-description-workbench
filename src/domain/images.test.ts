import { describe, expect, it } from 'vitest'
import type { DescriptionDocument, ImageAsset } from './types'
import { imageUsageCount, validateLocalImage } from './images'

const local: ImageAsset = { id: 'asset-1', name: 'shot.png', kind: 'local', url: null, mimeType: 'image/png', size: 3, createdAt: 1 }
const remote: ImageAsset = { id: 'asset-2', name: 'remote.png', kind: 'remote', url: 'https://example.com/shot.png', mimeType: 'image/remote', size: 0, createdAt: 1 }
const document = (nexusContent: string): DescriptionDocument => ({ id: crypto.randomUUID(), title: 'Doc', mode: 'bbcode', content: nexusContent, nexusContent, createdAt: 1, updatedAt: 1 })

describe('image library helpers', () => {
  it('counts canonical local and remote references', () => {
    expect(imageUsageCount([document('[img]asset://asset-1[/img]\n[img]asset://asset-1[/img]')], local)).toBe(2)
    expect(imageUsageCount([document('[img]https://example.com/shot.png[/img]')], remote)).toBe(1)
  })

  it('does not double-count equivalent mode buffers', () => {
    const item = { ...document('[img]asset://asset-1[/img]'), sources: { markdown: '![](asset://asset-1)', bbcode: '[img]asset://asset-1[/img]' } }
    expect(imageUsageCount([item], local)).toBe(1)
  })

  it('validates local type and size', () => {
    expect(validateLocalImage(new File(['ok'], 'ok.png', { type: 'image/png' }))).toBeNull()
    expect(validateLocalImage(new File(['no'], 'bad.svg', { type: 'image/svg+xml' }))).toContain('PNG')
    const tooLarge = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })
    expect(validateLocalImage(tooLarge)).toContain('10 MB')
  })
})
