import type { AvailableUpdate, UpdateProgress, UpdaterPlatform } from './types'

export type UpdateStatus = 'idle' | 'unavailable' | 'checking' | 'current' | 'available' | 'downloading' | 'ready' | 'restarting' | 'error'

export interface UpdateSummary {
  version: string
  date: string | null
  notes: string | null
}

export interface UpdateState {
  status: UpdateStatus
  currentVersion: string | null
  update: UpdateSummary | null
  downloadedBytes: number
  contentLength: number | null
  error: string | null
}

const initialState: UpdateState = {
  status: 'idle', currentVersion: null, update: null, downloadedBytes: 0, contentLength: null, error: null,
}

const semver = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

export function isReleaseVersion(value: string) {
  return semver.test(value)
}

function summaryFrom(update: AvailableUpdate): UpdateSummary {
  if (!isReleaseVersion(update.version)) throw new Error('The update service returned an invalid release version.')
  return {
    version: update.version,
    date: update.date?.slice(0, 128) ?? null,
    notes: update.notes?.replaceAll('\u0000', '').slice(0, 4000) ?? null,
  }
}

function errorMessage(action: 'check' | 'install' | 'restart', error: unknown) {
  const detail = error instanceof Error && error.message.trim() ? ` ${error.message.trim().slice(0, 240)}` : ''
  return `Could not ${action === 'check' ? 'check for updates' : action === 'install' ? 'install the update' : 'restart to finish the update'}.${detail}`
}

function unavailableState(platform: UpdaterPlatform): UpdateState {
  const error = platform.configuration.kind === 'development'
    ? 'Signed update checks are disabled while this desktop app is running in development.'
    : 'Signed updates are not configured for this desktop build.'
  return { ...initialState, status: 'unavailable', error }
}

export class UpdateController {
  private state = initialState
  private update: AvailableUpdate | null = null
  private operation = 0
  private readonly listeners = new Set<() => void>()

  constructor(private readonly loadPlatform: () => Promise<UpdaterPlatform>) {}

  getSnapshot = () => this.state

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private set(next: UpdateState) {
    this.state = next
    this.listeners.forEach((listener) => listener())
  }

  private busy() {
    return this.state.status === 'checking' || this.state.status === 'downloading' || this.state.status === 'restarting'
  }

  async check() {
    if (this.busy()) return false
    const operation = ++this.operation
    this.set({ ...this.state, status: 'checking', error: null, update: null, downloadedBytes: 0, contentLength: null })
    try {
      const platform = await this.loadPlatform()
      if (operation !== this.operation) return false
      if (platform.configuration.kind !== 'configured') {
        this.set(unavailableState(platform))
        return false
      }
      const [currentVersion, update] = await Promise.all([platform.currentVersion(), platform.check()])
      if (operation !== this.operation) {
        if (update) await update.close().catch(() => undefined)
        return false
      }
      this.update = update
      this.set({
        ...initialState,
        status: update ? 'available' : 'current',
        currentVersion,
        update: update ? summaryFrom(update) : null,
      })
      return Boolean(update)
    } catch (error) {
      if (operation !== this.operation) return false
      await this.closeUpdate()
      this.set({ ...this.state, status: 'error', error: errorMessage('check', error) })
      return false
    }
  }

  async install() {
    if (this.busy() || !this.update || this.state.status !== 'available') return false
    const operation = ++this.operation
    this.set({ ...this.state, status: 'downloading', error: null, downloadedBytes: 0, contentLength: null })
    try {
      await this.update.downloadAndInstall((progress) => this.applyProgress(operation, progress))
      if (operation !== this.operation) return false
      await this.closeUpdate()
      this.set({ ...this.state, status: 'ready', downloadedBytes: this.state.downloadedBytes })
      return true
    } catch (error) {
      if (operation !== this.operation) return false
      await this.closeUpdate()
      this.set({ ...this.state, status: 'error', error: errorMessage('install', error) })
      return false
    }
  }

  async restart() {
    if (this.busy() || this.state.status !== 'ready') return false
    const operation = ++this.operation
    this.set({ ...this.state, status: 'restarting', error: null })
    try {
      const platform = await this.loadPlatform()
      if (operation !== this.operation) return false
      await platform.relaunch()
      return true
    } catch (error) {
      if (operation !== this.operation) return false
      this.set({ ...this.state, status: 'error', error: errorMessage('restart', error) })
      return false
    }
  }

  invalidate() {
    this.operation += 1
    void this.closeUpdate()
    this.set(initialState)
  }

  private applyProgress(operation: number, progress: UpdateProgress) {
    if (operation !== this.operation) return
    if (progress.event === 'started') this.set({ ...this.state, contentLength: progress.contentLength })
    if (progress.event === 'progress') this.set({ ...this.state, downloadedBytes: this.state.downloadedBytes + progress.chunkLength })
  }

  private async closeUpdate() {
    const update = this.update
    this.update = null
    if (update) await update.close().catch(() => undefined)
  }
}
