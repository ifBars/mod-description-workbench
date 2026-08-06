import { fireEvent, render, screen } from '@testing-library/react'
import { SectionBuilderPanel } from './SectionBuilderPanel'

describe('SectionBuilderPanel', () => {
  it('configures and inserts a selected editorial section', () => {
    const onInsert = vi.fn()
    render(<SectionBuilderPanel mode="bbcode" onInsert={onInsert} />)
    fireEvent.change(screen.getByLabelText('Section type'), { target: { value: 'features' } })
    fireEvent.change(screen.getByLabelText('Heading'), { target: { value: 'Why it matters' } })
    fireEvent.change(screen.getByLabelText('Features'), { target: { value: 'Shared market: Trade with other players' } })
    fireEvent.click(screen.getByRole('button', { name: 'Insert feature section into document' }))
    expect(onInsert).toHaveBeenCalledWith(expect.stringContaining('[heading][size=5]Why it matters[/size][/heading]'))
    expect(onInsert).toHaveBeenCalledWith(expect.stringContaining('Shared market'))
  })

  it('explains hybrid source when inserting into Markdown', () => {
    render(<SectionBuilderPanel mode="markdown" onInsert={() => undefined} />)
    expect(screen.getByText(/hybrid BBCode/)).toBeInTheDocument()
  })
})
