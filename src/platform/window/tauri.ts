import { getCurrentWindow } from '@tauri-apps/api/window'
import type { DesktopWindow } from './types'

export function currentTauriWindow(): DesktopWindow {
  return getCurrentWindow()
}
