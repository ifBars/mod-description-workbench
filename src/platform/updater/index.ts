import { platformRuntime, type PlatformRuntime } from '../runtime'
import { browserUpdater } from './browser'
import type { UpdaterPlatform } from './types'

export type { AvailableUpdate, UpdateConfiguration, UpdateProgress, UpdaterPlatform } from './types'

export async function updaterPlatformForRuntime(runtime: PlatformRuntime): Promise<UpdaterPlatform> {
  if (runtime === 'browser') return browserUpdater
  return (await import('./tauri')).tauriUpdater
}

export function updaterPlatform(): Promise<UpdaterPlatform> {
  return updaterPlatformForRuntime(platformRuntime())
}
