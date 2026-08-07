import { describe, expect, it, vi } from 'vitest'

const { openMock, saveMock, readFileMock, writeFileMock } = vi.hoisted(() => ({
  openMock: vi.fn(), saveMock: vi.fn(), readFileMock: vi.fn(), writeFileMock: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: openMock, save: saveMock }))
vi.mock('@tauri-apps/plugin-fs', () => ({ readFile: readFileMock, writeFile: writeFileMock }))

import { tauriFiles } from './tauri'

const filters = [{ name: 'Workspace', extensions: ['mdw'] }]

describe('Tauri file platform', () => {
  it('treats cancelled open and save dialogs as normal no-ops', async () => {
    openMock.mockResolvedValueOnce(null)
    saveMock.mockResolvedValueOnce(null)
    await expect(tauriFiles.chooseFile({ filters })).resolves.toEqual({ cancelled: true })
    await expect(tauriFiles.saveFile({ filename: 'workspace.mdw', mimeType: 'application/octet-stream', bytes: new Uint8Array([1]), filters })).resolves.toEqual({ cancelled: true })
    expect(readFileMock).not.toHaveBeenCalled()
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it('passes filters through and reads selected bytes with the portable filename', async () => {
    openMock.mockResolvedValueOnce('C:\\Exports\\workspace.mdw')
    readFileMock.mockResolvedValueOnce(new Uint8Array([80, 75]))
    await expect(tauriFiles.chooseFile({ filters })).resolves.toEqual({ cancelled: false, file: { name: 'workspace.mdw', bytes: new Uint8Array([80, 75]) } })
    expect(openMock).toHaveBeenCalledWith({ directory: false, multiple: false, filters })
    expect(readFileMock).toHaveBeenCalledWith('C:\\Exports\\workspace.mdw')
  })

  it('passes suggested filenames, filters, and exact bytes to native save', async () => {
    const bytes = new Uint8Array([80, 75, 3, 4])
    saveMock.mockResolvedValueOnce('C:\\Exports\\workspace.mdw')
    await expect(tauriFiles.saveFile({ filename: 'workspace.mdw', mimeType: 'application/octet-stream', bytes, filters })).resolves.toEqual({ cancelled: false })
    expect(saveMock).toHaveBeenCalledWith({ defaultPath: 'workspace.mdw', filters })
    expect(writeFileMock).toHaveBeenCalledWith('C:\\Exports\\workspace.mdw', bytes)
  })

  it('propagates native dialog and filesystem failures for the UI to present', async () => {
    openMock.mockRejectedValueOnce(new Error('open denied'))
    readFileMock.mockRejectedValueOnce(new Error('read denied'))
    saveMock.mockResolvedValueOnce('C:\\Exports\\workspace.mdw')
    writeFileMock.mockRejectedValueOnce(new Error('write denied'))
    await expect(tauriFiles.chooseFile({ filters })).rejects.toThrow('open denied')
    openMock.mockResolvedValueOnce('C:\\Exports\\workspace.mdw')
    await expect(tauriFiles.chooseFile({ filters })).rejects.toThrow('read denied')
    await expect(tauriFiles.saveFile({ filename: 'workspace.mdw', mimeType: 'application/octet-stream', bytes: new Uint8Array([1]), filters })).rejects.toThrow('write denied')
  })
})
