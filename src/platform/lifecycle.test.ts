import { describe, expect, it, vi } from 'vitest'
import { createCloseRequestHandler, registerCloseLifecycle } from './lifecycle'
import type { CloseRequestedEvent, DesktopWindow } from './window'

function testWindow() {
  return { close: vi.fn(), minimize: vi.fn(), toggleMaximize: vi.fn(), startDragging: vi.fn(), onCloseRequested: vi.fn() } as unknown as DesktopWindow
}

describe('desktop close lifecycle', () => {
  it('prevents the native request, flushes, then closes without recursively flushing', async () => {
    const window = testWindow()
    const flush = vi.fn().mockResolvedValue(undefined)
    const preventDefault = vi.fn()
    const handler = createCloseRequestHandler(window, { flush, reportFailure: vi.fn() })
    window.close = vi.fn(async () => handler({ preventDefault }))

    await handler({ preventDefault })

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(flush).toHaveBeenCalledTimes(1)
    expect(window.close).toHaveBeenCalledTimes(1)
  })

  it('keeps the window open and reports a recoverable error when flushing fails', async () => {
    const window = testWindow()
    const reportFailure = vi.fn()
    const handler = createCloseRequestHandler(window, { flush: vi.fn().mockRejectedValue(new Error('disk unavailable')), reportFailure })
    const event: CloseRequestedEvent = { preventDefault: vi.fn() }

    await handler(event)

    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(window.close).not.toHaveBeenCalled()
    expect(reportFailure).toHaveBeenCalledOnce()
  })

  it('does not start a second flush while the first close request is active', async () => {
    const window = testWindow()
    let release!: () => void
    const flush = vi.fn(() => new Promise<void>((resolve) => { release = resolve }))
    const handler = createCloseRequestHandler(window, { flush, reportFailure: vi.fn() })
    const first = handler({ preventDefault: vi.fn() })
    await handler({ preventDefault: vi.fn() })
    expect(flush).toHaveBeenCalledOnce()
    release()
    await first
  })

  it('removes its event listener before allowing a flushed window to close', async () => {
    const window = testWindow()
    const unlisten = vi.fn()
    let handler!: (event: CloseRequestedEvent) => Promise<void>
    window.onCloseRequested = vi.fn(async (nextHandler) => { handler = nextHandler; return unlisten })
    window.close = vi.fn().mockResolvedValue(undefined)
    await registerCloseLifecycle(window, { flush: vi.fn().mockResolvedValue(undefined), reportFailure: vi.fn() })

    await handler({ preventDefault: vi.fn() })

    expect(unlisten).toHaveBeenCalledOnce()
    expect(window.close).toHaveBeenCalledOnce()
  })
})
