import { bbcodeToRichHTML, bbcodeToVisualHTML } from './bbcode'
import { bbcodeToMarkdown, convertContent, markdownToBBCode, visualHTMLToBBCode } from './convert'

describe('Markdown to Nexus BBCode conversion', () => {
  it.each([
    ['# Title', '[size=5]Title[/size]'],
    ['## Section', '[size=4]Section[/size]'],
    ['### Minor', '[b]Minor[/b]'],
    ['**bold**', '[b]bold[/b]'],
    ['~~strike~~', '[s]strike[/s]'],
    ['<u>underline</u>', '[u]underline[/u]'],
    ['<span style="color:#fb923c">orange</span>', '[color=#fb923c]orange[/color]'],
    ['*italic*', '[i]italic[/i]'],
    ['`code`', '[i][font=Courier New]code[/font][/i]'],
    ['> quote', '[quote]quote[/quote]'],
    ['---', '[line]'],
    ['[Link](https://example.com)', '[url=https://example.com]Link[/url]'],
    ['![Alt](https://example.com/a.png)', '[img]https://example.com/a.png[/img]'],
  ])('converts %s', (markdown, bbcode) => expect(markdownToBBCode(markdown)).toContain(bbcode))

  it('converts spoiler directives', () => expect(markdownToBBCode(':::spoiler Notes\nHidden\n:::')).toBe('[spoiler]Hidden[/spoiler]'))

  it('converts fenced code without leaking its language label', () => expect(markdownToBBCode('```ts\nconst safe = true\n```')).toBe('[code]const safe = true\n[/code]'))

  it('wraps consecutive bullets in a Nexus list', () => {
    expect(markdownToBBCode('- One\n- Two')).toBe('[list]\n[*]One\n[*]Two\n[/list]')
  })

  it('wraps consecutive numbered items in an ordered Nexus list', () => {
    expect(markdownToBBCode('1. One\n2. Two')).toBe('[list=1]\n[*]One\n[*]Two\n[/list]')
  })
})

describe('Nexus BBCode to Markdown conversion', () => {
  it.each([
    ['[size=5]Title[/size]', '# Title'],
    ['[heading]Title[/heading]', '## Title'],
    ['[b]bold[/b]', '**bold**'],
    ['[i]italic[/i]', '*italic*'],
    ['[url=https://example.com]Link[/url]', '[Link](https://example.com)'],
    ['[img]https://example.com/a.png[/img]', '![](https://example.com/a.png)'],
    ['[line]', '---'],
  ])('converts %s', (bbcode, markdown) => expect(bbcodeToMarkdown(bbcode)).toContain(markdown))

  it('uses the public conversion entry point in both directions', () => {
    const bbcode = convertContent('# Title\n\n**Body**', 'markdown', 'bbcode')
    expect(convertContent(bbcode, 'bbcode', 'markdown')).toContain('# Title')
  })

  it.each([
    '[color=#fb923c]orange[/color]',
    '[font=Arial]font[/font]',
    '[size=3]small heading[/size]',
    '[center]centred[/center]',
    '[quote=Bars]attributed[/quote]',
    '[img width=640 height=360]https://example.com/image.png[/img]',
  ])('preserves Nexus-only syntax in hybrid Markdown: %s', (bbcode) => {
    expect(markdownToBBCode(bbcodeToMarkdown(bbcode))).toContain(bbcode)
  })

  it('preserves ordered-list semantics through a mode round trip', () => {
    const bbcode = '[list=1]\n[*]First\n[*]Second\n[/list]'
    expect(markdownToBBCode(bbcodeToMarkdown(bbcode))).toBe(bbcode)
  })

  it('converts visual editor HTML through the Nexus-safe subset', () => {
    const bbcode = visualHTMLToBBCode('<h1>Title</h1><p><strong>Body</strong></p>')
    expect(bbcode).toContain('[size=5]Title[/size]')
    expect(bbcode).toContain('[b]Body[/b]')
  })

  it('converts Markdown to semantic visual HTML', () => {
    const html = bbcodeToRichHTML(markdownToBBCode('# Title\n\n- One\n- Two'))
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<ul>')
  })

  it('converts Nexus-flavoured Markdown extensions into styled visual HTML', () => {
    const html = bbcodeToRichHTML(markdownToBBCode('[u]under[/u] [color=#fb923c]orange[/color]'))
    expect(html).toContain('<u>under</u>')
    expect(html).toContain('style="color:#fb923c"')
  })

  it('renders Nexus BBCode as styled rich HTML without exposing source tags', () => {
    const html = bbcodeToRichHTML('[color=#fb923c][b]Release[/b][/color]\n[quote=Bars]Stable[/quote]\n[list=1][*]Fast[*]Local[/list]')
    expect(html).toContain('style="color:#fb923c"')
    expect(html).toContain('<strong>Release</strong>')
    expect(html).toContain('<blockquote data-cite="Bars">Stable</blockquote>')
    expect(html).toContain('<ol><li>Fast</li><li>Local</li></ol>')
    expect(html).not.toContain('[color=')
  })

  it('uses public Nexus font sizing in the Visual editor representation', () => {
    const html = bbcodeToVisualHTML('[size=3]Medium[/size][size=5]Title[/size]')
    expect(html).toContain('<span style="font-size:16px">Medium</span>')
    expect(html).toContain('<span style="font-size:24px">Title</span>')
    expect(visualHTMLToBBCode(html)).toBe('[size=3]Medium[/size][size=5]Title[/size]')
  })

  it('converts visual styles back to Nexus BBCode after an edit', () => {
    const bbcode = visualHTMLToBBCode('<p style="text-align:center"><span style="color:#fb923c"><strong>Edited</strong></span></p><blockquote><cite>Bars</cite>Stable</blockquote><img src="https://example.com/a.png" width="640">')
    expect(bbcode).toContain('[center][color=#fb923c][b]Edited[/b][/color][/center]')
    expect(bbcode).toContain('[quote=Bars]Stable[/quote]')
    expect(bbcode).toContain('[img width=640]https://example.com/a.png[/img]')
  })

  it('keeps Nexus visual-editor structures valid and round-trippable', () => {
    const source = '[color=#fb923c][b]Release[/b][/color]\n[quote=Bars]Stable[/quote]\n[list=1]\n[*]Fast\n[*]Local\n[/list]\n[spoiler]Secret[/spoiler]\n[img width=640 height=360]https://example.com/a.png[/img]'
    const rich = bbcodeToRichHTML(source)

    expect(rich).toContain('<blockquote data-cite="Bars">')
    expect(rich).toContain('<ol><li>Fast</li><li>Local</li></ol>')
    expect(rich).toContain('<details class="bbc-spoiler">')
    expect(visualHTMLToBBCode(rich)).toContain('[quote=Bars]Stable[/quote]')
    expect(visualHTMLToBBCode(rich)).toContain('[list=1]\n[*]Fast\n[*]Local\n[/list]')
    expect(visualHTMLToBBCode(rich)).toContain('[img width=640 height=360]https://example.com/a.png[/img]')
  })

  it('does not accumulate spacing across repeated visual serializations', () => {
    const source = '[size=5]Title[/size]\n\nBody\n\n[list]\n[*]One\n[*]Two\n[/list]\n\n[quote=Bars]Stable[/quote]'
    const once = visualHTMLToBBCode(bbcodeToRichHTML(source))
    const twice = visualHTMLToBBCode(bbcodeToRichHTML(once))
    expect(twice).toBe(once)
  })
})
