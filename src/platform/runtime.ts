import { isTauri } from '@tauri-apps/api/core'

export type PlatformRuntime = 'browser' | 'tauri'

export function runtimeFromTauriFlag(isDesktopRuntime: boolean): PlatformRuntime {
  return isDesktopRuntime ? 'tauri' : 'browser'
}

export function platformRuntime(): PlatformRuntime {
  return runtimeFromTauriFlag(isTauri())
}
