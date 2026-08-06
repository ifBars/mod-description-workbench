import { render } from '@testing-library/react'
import { bbcodeDiagnostics, renderBBCode } from './bbcode'
import { NEXUS_PUBLIC_FIDELITY_V2, NEXUS_PUBLIC_FIDELITY_V2_MEDIA } from '../fixtures/nexusPublicFidelityV2'

describe('captured Nexus compatibility fixture', () => {
  it('has no parser diagnostics in the core or optional media fixtures', () => {
    expect(bbcodeDiagnostics(NEXUS_PUBLIC_FIDELITY_V2)).toEqual([])
    expect(bbcodeDiagnostics(NEXUS_PUBLIC_FIDELITY_V2_MEDIA)).toEqual([])
  })

  it('renders the full fixture through the inert preview pipeline', () => {
    const { container } = render(<article>{renderBBCode(NEXUS_PUBLIC_FIDELITY_V2)}</article>)
    expect(container).toHaveTextContent('Nexus Public Fidelity Fixture v2')
    expect(container).toHaveTextContent('FIXTURE-END · MDW-PUBLIC-V2')
    expect(container.querySelectorAll('span[style*="font-size"]')).toHaveLength(7)
    expect(container.querySelectorAll('h2')).toHaveLength(9)
    expect(container.querySelectorAll('figure.nexus-quote')).toHaveLength(5)
    expect(container.querySelector('blockquote cite')).toHaveTextContent('Fixture author')
    expect(container.querySelectorAll('pre code')).toHaveLength(3)
    expect(container.querySelectorAll('ul')).toHaveLength(3)
    expect(container.querySelectorAll('ol')).toHaveLength(1)
    expect(container.querySelectorAll('li')).toHaveLength(10)
    expect(container.querySelectorAll('details.nexus-public-spoiler')).toHaveLength(2)
    expect(container.querySelectorAll('a')).toHaveLength(2)
    expect(container.querySelectorAll('hr')).toHaveLength(2)
    const courier = [...container.querySelectorAll<HTMLElement>('span')].find((element) => element.style.fontFamily.includes('Courier New'))
    expect(courier).toHaveTextContent('Courier New')
    const alignedText = (alignment: string) => [...container.querySelectorAll<HTMLElement>(`div[style*="text-align: ${alignment}"]`)].map((element) => element.textContent)
    expect(alignedText('left')).toEqual(expect.arrayContaining([expect.stringContaining('ALIGN-LEFT')]))
    expect(alignedText('center')).toEqual(expect.arrayContaining([expect.stringContaining('ALIGN-CENTRE')]))
    expect(alignedText('right')).toEqual(expect.arrayContaining([expect.stringContaining('ALIGN-RIGHT')]))
  })

  it('matches Nexus block-boundary newline handling', () => {
    const source = `[left]Left[/left]
[center]Centre[/center]
[right]Right[/right]

[quote]Quote[/quote]
[code]Code[/code]

[list]
[*]One
[/list]

[list=1]
[*]Two
[/list]`
    const { container } = render(<article>{renderBBCode(source)}</article>)
    const article = container.querySelector('article')!
    const sequence = [...article.childNodes].map((node) => node.nodeType === Node.TEXT_NODE ? JSON.stringify(node.textContent) : (node as Element).tagName)

    expect(sequence).toEqual(['DIV', 'DIV', 'DIV', 'BR', 'BR', 'FIGURE', 'PRE', 'BR', 'UL', 'BR', 'OL'])
  })

  it.each([
    ['[aimg=left]https://example.com/a.png[/aimg]', 'left'],
    ['[aimg=center]https://example.com/a.png[/aimg]', 'center'],
    ['[aimg=right]https://example.com/a.png[/aimg]', 'right'],
  ])('preserves aligned-image intent for %s', (source, align) => {
    const { container } = render(<div>{renderBBCode(source)}</div>)
    expect(container.querySelector('img')).toHaveAttribute('data-align', align)
  })

  it.each([
    ['[img width=640]https://example.com/a.png[/img]', '640', null],
    ['[img height=360]https://example.com/a.png[/img]', null, '360'],
    ['[img width=640,height=360]https://example.com/a.png[/img]', '640', '360'],
  ])('preserves captured image dimensions for %s', (source, width, height) => {
    const { container } = render(<div>{renderBBCode(source)}</div>)
    const image = container.querySelector('img')
    if (width) expect(image).toHaveAttribute('width', width); else expect(image).not.toHaveAttribute('width')
    if (height) expect(image).toHaveAttribute('height', height); else expect(image).not.toHaveAttribute('height')
  })

  it('resolves local asset references only through an explicit object URL map', () => {
    const withoutMap = render(<div>{renderBBCode('[img]asset://asset-1[/img]')}</div>)
    expect(withoutMap.container.querySelector('img')).not.toBeInTheDocument()
    withoutMap.unmount()
    const withMap = render(<div>{renderBBCode('[img]asset://asset-1[/img]', { 'asset-1': 'blob:https://local.test/asset' })}</div>)
    expect(withMap.container.querySelector('img')).toHaveAttribute('src', 'blob:https://local.test/asset')
  })
})
