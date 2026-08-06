import { renderMarkdown, renderRichText } from './markdown'

describe('Markdown rendering', () => {
  it('renders GFM headings, lists, and emphasis', () => {
    const html = renderMarkdown('# Title\n\n- **Bold**')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<strong>Bold</strong>')
  })

  it('renders the documented spoiler directive', () => {
    const html = renderMarkdown(':::spoiler Install\nHidden text\n:::')
    expect(html).toContain('<details class="bbc-spoiler">')
    expect(html).toContain('<summary>Install</summary>')
    expect(html).toContain('Hidden text')
  })

  it.each([
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<a href="javascript:alert(1)">bad</a>',
    '<svg><script>alert(1)</script></svg>',
  ])('sanitizes hostile Markdown HTML: %s', (source) => {
    const html = renderMarkdown(source)
    expect(html).not.toMatch(/script|onerror|javascript:/i)
  })
})

describe('Visual-editor rendering', () => {
  it('keeps ordinary formatting', () => expect(renderRichText('<p><strong>Safe</strong></p>')).toContain('<strong>Safe</strong>'))
  it('removes event handlers', () => expect(renderRichText('<p onclick="alert(1)">Safe</p>')).not.toContain('onclick'))
  it('removes active scripts', () => expect(renderRichText('<script>alert(1)</script><p>Safe</p>')).toBe('<p>Safe</p>'))
})
