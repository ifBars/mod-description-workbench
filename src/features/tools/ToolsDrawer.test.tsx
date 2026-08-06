import { fireEvent, render, screen } from '@testing-library/react'
import { createDefaultSnapshot } from '../../domain/defaults'
import { getWorkspaceSnapshot, workspaceActions } from '../../state/workspaceStore'
import { ToolsDrawer } from './ToolsDrawer'

const baseProps = {
  open: true,
  mode: 'bbcode' as const,
  documentContent: '[b]Whole document[/b]\nSecond line',
  documentId: 'document-default',
  onClose: () => undefined,
}

describe('ToolsDrawer workflow outcomes', () => {
  beforeEach(() => workspaceActions.replaceSnapshot(createDefaultSnapshot()))

  it('wraps only the captured selection when applying colour', () => {
    const onInsert = vi.fn()
    render(<ToolsDrawer {...baseProps} selection={{ content: 'Chosen words', hasSelection: true }} initialTab="color" onInsert={onInsert} />)

    expect(screen.getByText(/selected text “Chosen words” will be wrapped/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Apply colour to selected text' }))
    expect(onInsert).toHaveBeenCalledWith('[color=#d97732]Chosen words[/color]')
  })

  it('makes spoiler insertion explicit without implying it is saved', () => {
    const onInsert = vi.fn()
    render(<ToolsDrawer {...baseProps} selection={{ content: '', hasSelection: false }} initialTab="spoiler" onInsert={onInsert} />)

    expect(screen.getByText(/does not create a saved reusable item/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Insert spoiler into document' }))
    expect(onInsert).toHaveBeenCalledWith('\n\n[spoiler]Hidden details go here.[/spoiler]\n\n')
  })

  it('saves the whole document as a template even when text is selected', () => {
    render(<ToolsDrawer {...baseProps} selection={{ content: '[b]Whole document[/b]', hasSelection: true }} initialTab="templates" onInsert={() => undefined} />)

    expect(screen.getByText(/always captures the entire current document/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save entire document as template' }))
    expect(getWorkspaceSnapshot().templates[0]?.content).toBe(baseProps.documentContent)
  })
})
