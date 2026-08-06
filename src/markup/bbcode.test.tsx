import { render, screen } from '@testing-library/react'
import { BB_CODE_COMPLETIONS, bbcodeDiagnostics, parseBBCode, renderBBCode } from './bbcode'

describe('Nexus BBCode parser', () => {
  it.each([
    ['bold', '[b]Bold[/b]', 'strong'],
    ['italic', '[i]Italic[/i]', 'em'],
    ['underline', '[u]Under[/u]', 'u'],
    ['strike', '[s]Gone[/s]', 's'],
    ['heading', '[heading]Title[/heading]', 'h2'],
    ['quote', '[quote]Words[/quote]', 'blockquote'],
    ['code', '[code]const x = 1[/code]', 'pre'],
    ['unordered list', '[list][*]One[*]Two[/list]', 'ul'],
    ['ordered list', '[list=1][*]One[*]Two[/list]', 'ol'],
    ['line', '[line]', 'hr'],
  ])('renders %s', (_name, source, selector) => {
    const { container } = render(<div>{renderBBCode(source)}</div>)
    expect(container.querySelector(selector)).toBeInTheDocument()
  })

  it('renders nested inline formatting without losing text', () => {
    render(<div>{renderBBCode('[b]Bold and [i]italic[/i][/b]')}</div>)
    expect(screen.getByText('italic').tagName).toBe('EM')
    expect(screen.getByText(/Bold and/).closest('strong')).toBeInTheDocument()
  })

  it('uses the captured Nexus spoiler label and structure', () => {
    const { container } = render(<div>{renderBBCode('[spoiler]Secret[/spoiler]')}</div>)
    expect(screen.getByText('Spoiler:')).toBeInTheDocument()
    expect(screen.getByText('Show')).toBeInTheDocument()
    expect(container.querySelector('details.bbc-spoiler')).toHaveTextContent('Secret')
  })

  it('supports attributed quotes', () => {
    render(<div>{renderBBCode('[quote=Bars]Evidence[/quote]')}</div>)
    expect(screen.getByText('Bars').tagName).toBe('CITE')
  })

  it.each([
    ['[size=1]Small[/size]', '10px'],
    ['[size=2]Small[/size]', '13px'],
    ['[size=3]Body[/size]', '16px'],
    ['[size=4]Large[/size]', '18px'],
    ['[size=5]Larger[/size]', '24px'],
    ['[size=6]Largest[/size]', '32px'],
  ])('maps captured public-page size %s', (source, expected) => {
    const { container } = render(<div>{renderBBCode(source)}</div>)
    expect(container.querySelector('span')).toHaveStyle({ fontSize: expected })
  })

  it('rejects script URLs in links and images', () => {
    const { container } = render(<div>{renderBBCode('[url=javascript:alert(1)]bad[/url][img]javascript:alert(1)[/img]')}</div>)
    expect(container.querySelector('a')).not.toBeInTheDocument()
    expect(container.querySelector('img')).not.toBeInTheDocument()
    expect(screen.getByText('bad')).toBeInTheDocument()
  })

  it('renders media as inert placeholders rather than active iframes', () => {
    const { container } = render(<div>{renderBBCode('[youtube]abc-123[/youtube][video]https://example.com/v[/video]')}</div>)
    expect(container.querySelector('iframe')).not.toBeInTheDocument()
    expect(screen.getByText(/YouTube video/)).toBeInTheDocument()
    expect(screen.getByText(/video embed/)).toBeInTheDocument()
  })

  it('preserves unknown tags as readable text', () => {
    render(<div>{renderBBCode('[unknown]Text[/unknown]')}</div>)
    expect(screen.getByText('[unknown]Text[/unknown]')).toBeInTheDocument()
  })

  it('creates a stable tree for malformed nesting', () => {
    expect(() => parseBBCode('[b][i]text[/b][/i]')).not.toThrow()
  })

  it('does not turn structural list newlines into visible breaks', () => {
    const { container } = render(<div>{renderBBCode('[list]\n[*]First\n[*]Second\n[/list]')}</div>)
    expect(container.querySelectorAll('ul > br, li > br')).toHaveLength(0)
    expect([...container.querySelectorAll('li')].map((item) => item.textContent)).toEqual(['First', 'Second'])
  })

  it.each([
    '[img width=640 height=360]https://example.com/a.png[/img]',
    '[img width=640,height=360]https://example.com/a.png[/img]',
  ])('renders captured image dimension syntax: %s', (source) => {
    const { container } = render(<div>{renderBBCode(source)}</div>)
    const image = container.querySelector('img')!
    expect(image).toHaveAttribute('width', '640')
    expect(image).toHaveAttribute('height', '360')
  })
})

describe('BBCode diagnostics', () => {
  it.each([
    ['[wat]x[/wat]', 'Unknown tag [wat]'],
    ['[b]x', 'Missing closing tag [/b]'],
    ['x[/i]', 'Unexpected closing tag [/i]'],
    ['[b][i]x[/b][/i]', 'Unexpected closing tag [/b]'],
  ])('reports %s', (source, issue) => expect(bbcodeDiagnostics(source)).toContain(issue))

  it('accepts a nested supported fixture', () => {
    expect(bbcodeDiagnostics('[size=5]Title[/size]\n[list][*][b]One[/b][*]Two[/list]\n[spoiler]Secret[/spoiler]')).toEqual([])
  })

  it('deduplicates repeated diagnostics', () => {
    expect(bbcodeDiagnostics('[wat]a[/wat][wat]b[/wat]').filter((issue) => issue === 'Unknown tag [wat]')).toHaveLength(1)
  })
})

describe('BBCode autocomplete catalog', () => {
  it('offers every authorable Nexus tag without list-item noise', () => {
    const labels = BB_CODE_COMPLETIONS.map((completion) => completion.label)
    expect(labels).toEqual(expect.arrayContaining(['[b]', '[color]', '[spoiler]', '[youtube]', '[aimg]', '[line]']))
    expect(labels).not.toContain('[*]')
  })

  it('inserts paired tags and a standalone horizontal line', () => {
    expect(BB_CODE_COMPLETIONS.find((entry) => entry.label === '[spoiler]')?.apply).toBe('[spoiler]\n\n[/spoiler]')
    expect(BB_CODE_COMPLETIONS.find((entry) => entry.label === '[line]')?.apply).toBe('[line]')
  })
})
