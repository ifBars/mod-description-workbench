import { platformRuntime, type PlatformRuntime } from '../runtime'
import { browserWindow } from './browser'
import type { DesktopWindow } from './types'

export type { CloseRequestedEvent, DesktopWindow } from './types'

export async function desktopWindowForRuntime(runtime: PlatformRuntime): Promise<DesktopWindow | null> {
  if (runtime === 'browser') return browserWindow
  return (await import('./tauri')).currentTauriWindow()
}

export function desktopWindow() {
  return desktopWindowForRuntime(platformRuntime())
}
