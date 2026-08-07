import type { CloseRequestedEvent, DesktopWindow } from './window'

export interface CloseLifecycle {
  flush(): Promise<void>
  reportFailure(): void
}

export function createCloseRequestHandler(window: DesktopWindow, lifecycle: CloseLifecycle, allowClose = () => window.close()) {
  let closing = false
  let flushing = false

  return async (event: CloseRequestedEvent) => {
    if (closing) return
    event.preventDefault()
    if (flushing) return
    flushing = true
    try {
      await lifecycle.flush()
      closing = true
      await allowClose()
    } catch {
      closing = false
      lifecycle.reportFailure()
    } finally {
      flushing = false
    }
  }
}

export async function registerCloseLifecycle(window: DesktopWindow, lifecycle: CloseLifecycle) {
  let unlisten: () => void = () => undefined
  const handler = createCloseRequestHandler(window, lifecycle, async () => {
    unlisten()
    await window.close()
  })
  unlisten = await window.onCloseRequested(handler)
  return unlisten
}
