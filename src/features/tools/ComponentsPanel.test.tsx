import { fireEvent, render, screen } from '@testing-library/react'
import { createDefaultSnapshot } from '../../domain/defaults'
import { getWorkspaceSnapshot, workspaceActions } from '../../state/workspaceStore'
import { ComponentsPanel } from './ComponentsPanel'

describe('ComponentsPanel', () => {
  beforeEach(() => workspaceActions.replaceSnapshot(createDefaultSnapshot()))

  it('saves only the captured selection and previews before inserting', () => {
    const onInsert = vi.fn()
    render(<ComponentsPanel mode="bbcode" documentId={getWorkspaceSnapshot().activeDocumentId} documentContent={'[b]Desired line[/b]\nEverything below'} selection={{ content: '[b]Desired line[/b]', hasSelection: true }} onInsert={onInsert} />)

    expect(screen.getByLabelText('Component source')).toHaveValue('[b]Desired line[/b]')
    expect(screen.getByText('Desired line')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Component name'), { target: { value: 'Desired line' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save component' }))

    expect(getWorkspaceSnapshot().components[0]?.content).toBe('[b]Desired line[/b]')
    fireEvent.click(screen.getByRole('button', { name: /Desired line0 variables/ }))
    expect(onInsert).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Preview Desired line' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Insert into document' }))
    expect(onInsert).toHaveBeenCalledWith('\n\n[b]Desired line[/b]\n\n')
  })

  it('adds and inserts a variable token with a live default-value preview', () => {
    render(<ComponentsPanel mode="bbcode" documentId={getWorkspaceSnapshot().activeDocumentId} documentContent="" selection={{ content: '[b]Release [/b]', hasSelection: true }} onInsert={() => undefined} />)
    fireEvent.click(screen.getByText(/Add variables/))
    fireEvent.click(screen.getByRole('button', { name: 'Add and insert variable' }))
    expect(screen.getByLabelText('Component source')).toHaveValue('[b]Release [/b]{{version}}')
    expect(screen.getByText('1.0.0')).toBeInTheDocument()
  })
})
