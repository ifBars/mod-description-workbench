import type { AvailableUpdate, UpdateProgress, UpdaterPlatform } from './types'

function configuration() {
  if (import.meta.env.DEV) return { kind: 'development' } as const
  return import.meta.env.VITE_TAURI_UPDATER_CONFIGURED === 'true'
    ? { kind: 'configured' } as const
    : { kind: 'missing' } as const
}

function toProgress(event: { event: string; data?: { contentLength?: number; chunkLength?: number } }): UpdateProgress | null {
  if (event.event === 'Started') return { event: 'started', contentLength: event.data?.contentLength ?? null }
  if (event.event === 'Progress' && typeof event.data?.chunkLength === 'number') return { event: 'progress', chunkLength: event.data.chunkLength }
  return event.event === 'Finished' ? { event: 'finished' } : null
}

export const tauriUpdater: UpdaterPlatform = {
  get configuration() { return configuration() },
  async currentVersion() {
    return (await import('@tauri-apps/api/app')).getVersion()
  },
  async check() {
    const update = await (await import('@tauri-apps/plugin-updater')).check()
    if (!update) return null
    const available: AvailableUpdate = {
      version: update.version,
      date: update.date ?? null,
      notes: update.body ?? null,
      async downloadAndInstall(onProgress) {
        await update.downloadAndInstall((event) => {
          const progress = toProgress(event)
          if (progress) onProgress(progress)
        })
      },
      async close() { await update.close() },
    }
    return available
  },
  async relaunch() {
    await (await import('@tauri-apps/plugin-process')).relaunch()
  },
}
