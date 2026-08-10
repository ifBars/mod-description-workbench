import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { NexusPreview } from './NexusPreview'
import { convertContent } from '../../markup/convert'

describe('NexusPreview', () => {
  it('renders BBCode and shows a clean compatibility state', () => {
    render(<NexusPreview content="[heading]Features[/heading][list][*]Fast[/list]" mode="bbcode" device="desktop" zoom={100} onDeviceChange={() => undefined} />)
    expect(screen.getByRole('heading', { name: 'Features' })).toBeInTheDocument()
    expect(screen.getByText('No compatibility issues')).toBeInTheDocument()
  })

  it('shows diagnostics for unsupported BBCode', () => {
    render(<NexusPreview content="[rainbow]Text[/rainbow]" mode="bbcode" device="desktop" zoom={100} onDeviceChange={() => undefined} />)
    expect(screen.getByText('1 issue')).toBeInTheDocument()
  })

  it('switches preview device', () => {
    const onChange = vi.fn()
    render(<NexusPreview content="Body" mode="markdown" device="desktop" zoom={100} onDeviceChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Mobile/ }))
    expect(onChange).toHaveBeenCalledWith('mobile')
  })

  it('applies preview zoom as an isolated scale token', () => {
    const { container } = render(<NexusPreview content="Body" mode="markdown" device="mobile" zoom={85} onDeviceChange={() => undefined} />)
    expect(container.querySelector('.nexus-surface')).toHaveStyle({ '--preview-zoom': '0.85' })
  })

  it('renders through the shared Nexus description surface', () => {
    const { container } = render(<NexusPreview content="[b]Shared renderer[/b]" mode="bbcode" device="desktop" zoom={100} onDeviceChange={() => undefined} />)
    expect(container.querySelector('.nexus-surface.desktop .nexus-description strong')).toHaveTextContent('Shared renderer')
  })

  it('warns when a local-only image cannot be exported to Nexus', () => {
    render(<NexusPreview content="![Local](asset://asset-1)" mode="markdown" device="desktop" zoom={100} assetUrls={{ 'asset-1': 'blob:https://local.test/asset' }} onDeviceChange={() => undefined} />)
    expect(screen.getByText('1 issue')).toBeInTheDocument()
  })

  it('renders equivalent Markdown and BBCode identically', () => {
    const markdown = '# Release\n\n**Stable**\n\n- Fast\n- Local\n\n:::spoiler\nSecret\n:::'
    const bbcode = convertContent(markdown, 'markdown', 'bbcode')
    const first = render(<NexusPreview content={markdown} mode="markdown" device="desktop" zoom={100} onDeviceChange={() => undefined} />)
    const markdownHtml = first.container.querySelector('.nexus-description')?.innerHTML
    first.unmount()
    const second = render(<NexusPreview content={bbcode} mode="bbcode" device="desktop" zoom={100} onDeviceChange={() => undefined} />)
    expect(second.container.querySelector('.nexus-description')?.innerHTML).toBe(markdownHtml)
  })

  it('keeps a Nexus-heavy BBCode preview stable after switching to Markdown', () => {
    const bbcode = '[size=3][color=#fb923c]Release[/color][/size]\n[quote=Bars]Stable[/quote]\n[list=1]\n[*]Fast\n[*]Local\n[/list]\n[center][img width=640]https://example.com/a.png[/img][/center]'
    const first = render(<NexusPreview content={bbcode} mode="bbcode" device="desktop" zoom={100} onDeviceChange={() => undefined} />)
    const bbcodeHtml = first.container.querySelector('.nexus-description')?.innerHTML
    first.unmount()
    const markdown = convertContent(bbcode, 'bbcode', 'markdown')
    const second = render(<NexusPreview content={markdown} mode="markdown" device="desktop" zoom={100} onDeviceChange={() => undefined} />)
    expect(second.container.querySelector('.nexus-description')?.innerHTML).toBe(bbcodeHtml)
  })
})
