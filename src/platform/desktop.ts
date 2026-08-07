import { platformRuntime } from './runtime'
import { desktopWindow } from './window'
import type { CloseLifecycle } from './lifecycle'

export async function registerDesktopCloseLifecycle(lifecycle: CloseLifecycle) {
  if (platformRuntime() !== 'tauri') return () => undefined
  const window = await desktopWindow()
  if (!window) return () => undefined
  const { registerCloseLifecycle } = await import('./lifecycle')
  return registerCloseLifecycle(window, lifecycle)
}
