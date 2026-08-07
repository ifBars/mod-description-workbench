import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UpdateController } from '../../platform/updater/controller'
import type { AvailableUpdate, UpdaterPlatform } from '../../platform/updater'
import { DesktopUpdatesSection } from './DesktopUpdatesSection'

function testPlatform(update: AvailableUpdate): UpdaterPlatform {
  return {
    configuration: { kind: 'configured' }, currentVersion: async () => '0.1.0', check: async () => update, relaunch: async () => undefined,
  }
}

describe('DesktopUpdatesSection', () => {
  it('requires confirmation before starting an update download', async () => {
    const downloadAndInstall = vi.fn(async () => undefined)
    const update: AvailableUpdate = { version: '0.2.0', date: null, notes: 'Fixes', downloadAndInstall, close: async () => undefined }
    const controller = new UpdateController(async () => testPlatform(update))
    render(<DesktopUpdatesSection controller={controller} />)

    fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }))
    await screen.findByText('Version 0.2.0 is available.')
    fireEvent.click(screen.getByRole('button', { name: 'Download update' }))
    expect(screen.getByRole('region', { name: 'Confirm update installation' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(downloadAndInstall).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Download update' }))
    fireEvent.click(screen.getByRole('button', { name: 'Install update' }))
    await waitFor(() => expect(downloadAndInstall).toHaveBeenCalledOnce())
  })

  it('renders adapter errors as a recoverable status', async () => {
    const controller = new UpdateController(async () => ({ ...testPlatform({ version: '0.2.0', date: null, notes: null, downloadAndInstall: async () => undefined, close: async () => undefined }), check: async () => { throw new Error('offline') } }))
    render(<DesktopUpdatesSection controller={controller} />)

    fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not check for updates. offline')
  })
})
