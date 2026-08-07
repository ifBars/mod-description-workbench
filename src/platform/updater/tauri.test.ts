import { describe, expect, it, vi } from 'vitest'

const { checkMock, getVersionMock, relaunchMock } = vi.hoisted(() => ({
  checkMock: vi.fn(), getVersionMock: vi.fn(), relaunchMock: vi.fn(),
}))

vi.mock('@tauri-apps/api/app', () => ({ getVersion: getVersionMock }))
vi.mock('@tauri-apps/plugin-updater', () => ({ check: checkMock }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: relaunchMock }))

import { tauriUpdater } from './tauri'

describe('Tauri updater platform', () => {
  it('adapts current version, signed update metadata, progress, and restart calls', async () => {
    const close = vi.fn(async () => undefined)
    const downloadAndInstall = vi.fn(async (listener: (event: { event: string; data?: { contentLength?: number; chunkLength?: number } }) => void) => {
      listener({ event: 'Started', data: { contentLength: 10 } })
      listener({ event: 'Progress', data: { chunkLength: 4 } })
      listener({ event: 'Finished' })
    })
    getVersionMock.mockResolvedValueOnce('0.1.0')
    checkMock.mockResolvedValueOnce({ version: '0.2.0', date: '2026-08-07', body: 'Notes', downloadAndInstall, close })

    await expect(tauriUpdater.currentVersion()).resolves.toBe('0.1.0')
    const update = await tauriUpdater.check()
    const progress: unknown[] = []
    await update!.downloadAndInstall((event) => progress.push(event))
    await update!.close()
    await tauriUpdater.relaunch()

    expect(progress).toEqual([{ event: 'started', contentLength: 10 }, { event: 'progress', chunkLength: 4 }, { event: 'finished' }])
    expect(close).toHaveBeenCalledOnce()
    expect(relaunchMock).toHaveBeenCalledOnce()
  })

  it('propagates updater adapter failures for the controller to present', async () => {
    checkMock.mockRejectedValueOnce(new Error('offline'))
    await expect(tauriUpdater.check()).rejects.toThrow('offline')
  })
})
