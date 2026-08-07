export type UpdateConfiguration =
  | { kind: 'configured' }
  | { kind: 'development' }
  | { kind: 'missing' }

export type UpdateProgress =
  | { event: 'started'; contentLength: number | null }
  | { event: 'progress'; chunkLength: number }
  | { event: 'finished' }

export interface AvailableUpdate {
  version: string
  date: string | null
  notes: string | null
  downloadAndInstall(onProgress: (progress: UpdateProgress) => void): Promise<void>
  close(): Promise<void>
}

export interface UpdaterPlatform {
  configuration: UpdateConfiguration
  currentVersion(): Promise<string>
  check(): Promise<AvailableUpdate | null>
  relaunch(): Promise<void>
}
