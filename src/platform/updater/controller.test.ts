import { describe, expect, it, vi } from 'vitest'
import { UpdateController, isReleaseVersion } from './controller'
import type { AvailableUpdate, UpdaterPlatform } from './types'

function available(version = '0.2.0'): AvailableUpdate {
  return {
    version, date: '2026-08-07T00:00:00Z', notes: 'A calm update.',
    downloadAndInstall: vi.fn(async (progress) => {
      progress({ event: 'started', contentLength: 100 })
      progress({ event: 'progress', chunkLength: 40 })
      progress({ event: 'progress', chunkLength: 60 })
      progress({ event: 'finished' })
    }),
    close: vi.fn(async () => undefined),
  }
}

function platform(update: AvailableUpdate | null, overrides: Partial<UpdaterPlatform> = {}): UpdaterPlatform {
  return {
    configuration: { kind: 'configured' },
    currentVersion: vi.fn(async () => '0.1.0'),
    check: vi.fn(async () => update),
    relaunch: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('desktop update controller', () => {
  it('accepts SemVer releases and rejects malformed metadata before it can be installed', async () => {
    expect(isReleaseVersion('0.2.0-beta.1')).toBe(true)
    expect(isReleaseVersion('v1.2.3+build.9')).toBe(true)
    expect(isReleaseVersion('release-candidate')).toBe(false)
    const update = available('release-candidate')
    const controller = new UpdateController(async () => platform(update))

    await expect(controller.check()).resolves.toBe(false)
    expect(controller.getSnapshot()).toMatchObject({ status: 'error', error: expect.stringContaining('invalid release version') })
    expect(update.close).toHaveBeenCalledOnce()
  })

  it('prevents concurrent checks and only adopts the first completed operation', async () => {
    let resolveCheck: (update: AvailableUpdate | null) => void = () => undefined
    const check = vi.fn(() => new Promise<AvailableUpdate | null>((resolve) => { resolveCheck = resolve }))
    const controller = new UpdateController(async () => platform(null, { check }))

    const first = controller.check()
    await Promise.resolve()
    await expect(controller.check()).resolves.toBe(false)
    resolveCheck(available())
    await expect(first).resolves.toBe(true)
    expect(check).toHaveBeenCalledOnce()
    expect(controller.getSnapshot()).toMatchObject({ status: 'available', update: { version: '0.2.0' } })
  })

  it('tracks trustworthy download progress and waits for an explicit restart', async () => {
    const update = available()
    const native = platform(update)
    const controller = new UpdateController(async () => native)

    await controller.check()
    await expect(controller.install()).resolves.toBe(true)
    expect(controller.getSnapshot()).toMatchObject({ status: 'ready', downloadedBytes: 100, contentLength: 100 })
    expect(native.relaunch).not.toHaveBeenCalled()
    await expect(controller.restart()).resolves.toBe(true)
    expect(native.relaunch).toHaveBeenCalledOnce()
  })

  it('keeps failures recoverable and does not report a false ready state', async () => {
    const update = available()
    vi.mocked(update.downloadAndInstall).mockRejectedValueOnce(new Error('signature verification failed'))
    const controller = new UpdateController(async () => platform(update))

    await controller.check()
    await expect(controller.install()).resolves.toBe(false)
    expect(controller.getSnapshot()).toMatchObject({ status: 'error', error: expect.stringContaining('signature verification failed') })
  })

  it('reports absent release configuration without calling the updater endpoint', async () => {
    const check = vi.fn()
    const controller = new UpdateController(async () => platform(null, { configuration: { kind: 'missing' }, check }))

    await expect(controller.check()).resolves.toBe(false)
    expect(check).not.toHaveBeenCalled()
    expect(controller.getSnapshot()).toMatchObject({ status: 'unavailable', error: expect.stringContaining('not configured') })
  })
})
