import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createDefaultSnapshot } from '../../domain/defaults'
import { getWorkspaceSnapshot, workspaceActions } from '../../state/workspaceStore'
import { SettingsPage } from './SettingsPage'

describe('SettingsPage', () => {
  beforeEach(() => workspaceActions.replaceSnapshot(createDefaultSnapshot()))

  it('removes About and exposes working autosave and recovery controls', () => {
    render(<SettingsPage />)

    expect(screen.queryByRole('button', { name: 'About' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Autosave & recovery' }))
    fireEvent.change(screen.getByLabelText('Autosave idle delay'), { target: { value: '1000' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Recovery checkpoints/ }))

    expect(getWorkspaceSnapshot().preferences).toMatchObject({ autosaveDelayMs: 1000, recoveryEnabled: false })
    expect(screen.queryByLabelText('Recovery checkpoint delay')).not.toBeInTheDocument()
  })

  it('lists the expanded source-editor shortcut reference', () => {
    render(<SettingsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Keyboard' }))

    expect(screen.getByText('Undo')).toBeInTheDocument()
    expect(screen.getByText('Redo')).toBeInTheDocument()
    expect(screen.getByText('Find previous')).toBeInTheDocument()
    expect(screen.getByText('Outdent line or selection')).toBeInTheDocument()
    expect(screen.getByText('BBCode autocomplete')).toBeInTheDocument()
  })

  it('does not expose desktop updater controls in the browser runtime', () => {
    render(<SettingsPage />)

    expect(screen.queryByRole('button', { name: 'Desktop updates' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check for updates' })).not.toBeInTheDocument()
  })

  it('requires explicit confirmation before resetting all local data', async () => {
    const reset = vi.spyOn(workspaceActions, 'resetAllData').mockResolvedValue()
    render(<SettingsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Privacy & data' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset all local data' }))

    expect(reset).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog', { name: 'Reset all local data?' })).toHaveTextContent('every draft, recovery checkpoint, local image, theme, template, component, and preference')
    fireEvent.click(screen.getByRole('button', { name: 'Reset everything' }))
    await waitFor(() => expect(reset).toHaveBeenCalledOnce())
    reset.mockRestore()
  })
})
