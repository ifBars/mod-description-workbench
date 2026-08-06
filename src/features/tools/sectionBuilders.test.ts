import { bbcodeDiagnostics } from '../../markup/bbcode'
import { SECTION_BUILDERS, renderSectionBuilder } from './sectionBuilders'

describe('editorial section builders', () => {
  it.each(SECTION_BUILDERS.map((builder) => [builder.name, builder.id, builder.defaults] as const))('renders diagnostic-free BBCode for %s', (_name, id, defaults) => {
    expect(bbcodeDiagnostics(renderSectionBuilder(id, defaults))).toEqual([])
  })

  it('builds labelled feature items and safe requirement links', () => {
    const features = renderSectionBuilder('features', { title: 'Features', intro: 'Intro', items: 'Market: Trade safely', accent: '#3d85c6' })
    const requirements = renderSectionBuilder('requirements', { title: 'Requirements', items: 'Loader | https://example.com/loader\nPlain dependency', accent: '#6aa84f' })
    expect(features).toContain('[b][color=#3d85c6]Market[/color][/b]: [color=#d8d8d8]Trade safely[/color]')
    expect(requirements).toContain('[url=https://example.com/loader][color=#6aa84f]Loader[/color][/url]')
    expect(requirements).toContain('[*]Plain dependency[/*]')
  })

  it('does not let requirement URLs introduce BBCode structure', () => {
    const source = renderSectionBuilder('requirements', { title: 'Requirements', items: 'Loader | https://example.com/[b]unsafe', accent: '#6aa84f' })
    expect(source).not.toContain('[url=')
    expect(source).toContain('[*]Loader[/*]')
  })

  it('accepts a YouTube URL while keeping invalid media inert', () => {
    expect(renderSectionBuilder('media', { title: 'Help', body: 'Watch this.', video: 'https://youtu.be/dQw4w9WgXcQ', accent: '#ffff00' })).toContain('[youtube]dQw4w9WgXcQ[/youtube]')
    expect(renderSectionBuilder('media', { title: 'Help', body: 'Watch this.', video: 'not a video', accent: '#ffff00' })).not.toContain('[youtube]')
  })

  it('escapes structural tags entered as plain field content', () => {
    const source = renderSectionBuilder('announcement', { title: '[script]Nope', body: '[b]Plain[/b]', accent: 'invalid' })
    expect(source).toContain('&#91;script]Nope')
    expect(source).toContain('&#91;b]Plain&#91;/b]')
  })
})
