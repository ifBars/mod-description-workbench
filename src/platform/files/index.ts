import { platformRuntime } from '../runtime'
import { browserFiles } from './browser'
import type { FilePlatform } from './types'

export type { ChooseFileRequest, FileFilter, FilePlatform, FileSelection, SaveFileRequest, SaveFileResult, SelectedFile } from './types'

export async function filePlatformForRuntime(runtime: ReturnType<typeof platformRuntime>): Promise<FilePlatform> {
  if (runtime === 'browser') return browserFiles
  return (await import('./tauri')).tauriFiles
}

export function filePlatform(): Promise<FilePlatform> {
  return filePlatformForRuntime(platformRuntime())
}
