import { describe, expect, it, vi } from 'vitest'
import type { MouseEvent } from 'react'
import { openExternalUrl, routeExternalLinkForRuntime, safeExternalUrl } from './externalLinks'

describe('external link platform boundary', () => {
  it.each(['https://example.com/path?next=one', 'http://example.com'])('accepts user-facing HTTP(S) URLs: %s', (value) => {
    expect(safeExternalUrl(value)).toMatch(/^https?:\/\/example\.com/)
  })

  it.each(['javascript:alert(1)', 'data:text/html,hello', 'file:///C:/secret.txt', '/relative'])('rejects unsupported external URL schemes: %s', (value) => {
    expect(safeExternalUrl(value)).toBeNull()
  })

  it('opens valid desktop links in the system browser through the injected opener', async () => {
    const open = vi.fn().mockResolvedValue(undefined)
    await expect(openExternalUrl('https://example.com/docs', open)).resolves.toBe(true)
    expect(open).toHaveBeenCalledWith('https://example.com/docs')
  })

  it('leaves browser navigation alone but prevents Tauri WebView navigation', async () => {
    const browserEvent = { currentTarget: { href: 'https://example.com' }, preventDefault: vi.fn() } as unknown as MouseEvent<HTMLAnchorElement>
    await expect(routeExternalLinkForRuntime(browserEvent, 'browser')).resolves.toBe(false)
    expect(browserEvent.preventDefault).not.toHaveBeenCalled()

    const open = vi.fn().mockResolvedValue(undefined)
    const desktopEvent = { currentTarget: { href: 'https://example.com' }, preventDefault: vi.fn() } as unknown as MouseEvent<HTMLAnchorElement>
    await expect(routeExternalLinkForRuntime(desktopEvent, 'tauri', open)).resolves.toBe(true)
    expect(desktopEvent.preventDefault).toHaveBeenCalledOnce()
    expect(open).toHaveBeenCalledWith('https://example.com/')
  })
})
