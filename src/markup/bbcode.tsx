import type { ReactNode } from 'react'

interface TagNode {
  type: 'tag'
  name: string
  attribute?: string
  children: BbNode[]
}

interface TextNode { type: 'text'; value: string }
type BbNode = TagNode | TextNode

const SUPPORTED_TAGS = new Set([
  'b', 'i', 'u', 's', 'color', 'size', 'font', 'left', 'center', 'right', 'quote', 'code',
  'list', '*', 'spoiler', 'url', 'img', 'aimg', 'youtube', 'video', 'soundcloud', 'twitter', 'heading', 'line',
])

const tokenPattern = /\[(\/)?([a-z*]+)(?:(?:=|\s+)([^\]]+))?\]/gi

export function parseBBCode(input: string): BbNode[] {
  const root: TagNode = { type: 'tag', name: 'root', children: [] }
  const stack = [root]
  let cursor = 0

  for (const match of input.matchAll(tokenPattern)) {
    const index = match.index ?? 0
    if (index > cursor) stack.at(-1)!.children.push({ type: 'text', value: input.slice(cursor, index) })
    const closing = Boolean(match[1])
    const name = match[2]!.toLowerCase()
    const attribute = match[3]?.trim()

    if (!SUPPORTED_TAGS.has(name)) {
      stack.at(-1)!.children.push({ type: 'text', value: match[0] })
    } else if (name === 'line') {
      stack.at(-1)!.children.push({ type: 'tag', name, children: [] })
    } else if (name === '*' && !closing) {
      while (stack.length > 1 && stack.at(-1)!.name === '*') stack.pop()
      const node: TagNode = { type: 'tag', name, children: [] }
      stack.at(-1)!.children.push(node)
      stack.push(node)
    } else if (closing) {
      const openingIndex = stack.findLastIndex((node) => node.name === name)
      if (openingIndex > 0) stack.splice(openingIndex)
      else stack.at(-1)!.children.push({ type: 'text', value: match[0] })
    } else {
      const node: TagNode = { type: 'tag', name, ...(attribute ? { attribute } : {}), children: [] }
      stack.at(-1)!.children.push(node)
      stack.push(node)
    }
    cursor = index + match[0].length
  }
  if (cursor < input.length) stack.at(-1)!.children.push({ type: 'text', value: input.slice(cursor) })
  return root.children
}

function textContent(nodes: BbNode[]): string {
  return nodes.map((node) => node.type === 'text' ? node.value : textContent(node.children)).join('')
}

function withoutBoundaryNewlines(nodes: BbNode[]) {
  return nodes.map((node, index) => node.type === 'text'
    ? { ...node, value: node.value.replace(index === 0 ? /^\r?\n/ : /$^/, '').replace(index === nodes.length - 1 ? /\r?\n$/ : /$^/, '') }
    : node)
}

const nexusBlockTags = new Set(['left', 'center', 'right', 'heading', 'quote', 'code', 'list', 'spoiler'])

function isNexusBlock(node: BbNode | undefined): node is TagNode {
  return node?.type === 'tag' && nexusBlockTags.has(node.name)
}

/**
 * Nexus' BBCode renderer consumes the newline that separates most adjacent
 * block tags. Blank lines remain visible, while alignment blocks preserve an
 * explicitly empty line after them. Normalizing only root boundary nodes keeps
 * newlines inside quotes, lists, and other content intact.
 */
function nexusRootNodes(nodes: BbNode[]) {
  return nodes.flatMap((node, index): BbNode[] => {
    if (node.type !== 'text' || !/^\r?\n(?:\r?\n)*$/.test(node.value)) return [node]
    const previous = nodes[index - 1]
    const next = nodes[index + 1]
    if (!isNexusBlock(previous) || !isNexusBlock(next)) return [node]

    const newlineCount = node.value.match(/\n/g)?.length ?? 0
    const preserveCount = newlineCount > 1 && ['left', 'center', 'right'].includes(previous.name)
      ? newlineCount
      : Math.max(0, newlineCount - 1)
    return preserveCount ? [{ ...node, value: '\n'.repeat(preserveCount) }] : []
  })
}

function safeUrl(value: string, media = false, assetUrls: Record<string, string> = {}) {
  if (media && value.startsWith('asset://')) return assetUrls[value.slice('asset://'.length)]
  try {
    const url = new URL(value, window.location.origin)
    if (url.protocol === 'https:' || url.protocol === 'http:' || (media && url.protocol === 'data:')) return url.href
  } catch { return undefined }
  return undefined
}

const fontSizes: Record<string, string> = { '1': '10px', '2': '13px', '3': '14px', '4': '18px', '5': '24px', '6': '32px' }
const publicFontSizes: Record<string, string> = { ...fontSizes, '3': '16px' }

function imageDimensions(attribute = '') {
  return Object.fromEntries([...attribute.matchAll(/(width|height)\s*=\s*(\d+)/gi)].map((match) => [match[1]!.toLowerCase(), match[2]!]))
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function richHtmlNode(node: BbNode, assetUrls: Record<string, string>, publicFidelity = false): string {
  if (node.type === 'text') return escapeHtml(node.value).replace(/\n/g, '<br>')
  const children = node.children.map((child) => richHtmlNode(child, assetUrls, publicFidelity)).join('')
  const wrap = (tag: string, attributes = '') => `<${tag}${attributes}>${children}</${tag}>`
  switch (node.name) {
    case 'b': return wrap('strong')
    case 'i': return wrap('em')
    case 'u': return wrap('u')
    case 's': return wrap('s')
    case 'color': return wrap('span', /^#[0-9a-f]{3,8}$/i.test(node.attribute ?? '') ? ` style="color:${node.attribute}"` : '')
    case 'size': {
      if (publicFidelity) return wrap('span', publicFontSizes[node.attribute ?? ''] ? ` style="font-size:${publicFontSizes[node.attribute ?? '']}"` : '')
      return node.attribute === '5' ? wrap('h1') : node.attribute === '4' ? wrap('h2') : wrap('span', fontSizes[node.attribute ?? ''] ? ` style="font-size:${fontSizes[node.attribute ?? '']}"` : '')
    }
    case 'font': return wrap('span', /^[\w -]{1,40}$/.test(node.attribute ?? '') ? ` style="font-family:${escapeHtml(node.attribute!)}"` : '')
    case 'left': case 'center': case 'right': return wrap('p', ` style="text-align:${node.name}"`)
    case 'heading': return wrap('h2')
    case 'quote': return `<blockquote${node.attribute ? ` data-cite="${escapeHtml(node.attribute)}"` : ''}>${children}</blockquote>`
    case 'code': return `<pre><code>${escapeHtml(textContent(node.children))}</code></pre>`
    case 'spoiler': return `<details class="bbc-spoiler"><summary>Spoiler (click to show)</summary><div>${children}</div></details>`
    case 'list': {
      const items = node.children
        .filter((child): child is TagNode => child.type === 'tag' && child.name === '*')
        .map((child) => richHtmlNode(child, assetUrls, publicFidelity))
        .join('')
      return `<${node.attribute === '1' ? 'ol' : 'ul'}>${items}</${node.attribute === '1' ? 'ol' : 'ul'}>`
    }
    case '*': return `<li>${withoutBoundaryNewlines(node.children).map((child) => richHtmlNode(child, assetUrls, publicFidelity)).join('')}</li>`
    case 'url': {
      const href = safeUrl(node.attribute ?? textContent(node.children))
      return href ? wrap('a', ` href="${escapeHtml(href)}"`) : children
    }
    case 'img': case 'aimg': {
      const src = safeUrl(textContent(node.children), true, assetUrls)
      if (!src) return ''
      const dimensions = imageDimensions(node.attribute)
      return `<img src="${escapeHtml(src)}" alt=""${Number(dimensions.width) ? ` width="${Number(dimensions.width)}"` : ''}${Number(dimensions.height) ? ` height="${Number(dimensions.height)}"` : ''}>`
    }
    case 'line': return '<hr>'
    case 'youtube': case 'video': case 'soundcloud': case 'twitter': return `<p><em>${escapeHtml(node.name)}: ${escapeHtml(textContent(node.children))}</em></p>`
    default: return children
  }
}

export function bbcodeToRichHTML(input: string, assetUrls: Record<string, string> = {}) {
  return parseBBCode(input).map((node) => richHtmlNode(node, assetUrls)).join('')
}

export function bbcodeToVisualHTML(input: string, assetUrls: Record<string, string> = {}) {
  return nexusRootNodes(parseBBCode(input)).map((node) => richHtmlNode(node, assetUrls, true)).join('')
}

function renderNode(node: BbNode, key: string, assetUrls: Record<string, string>): ReactNode {
  if (node.type === 'text') return node.value.split('\n').flatMap((part, index, lines) => index < lines.length - 1 ? [part, <br key={`${key}-br-${index}`} />] : [part])
  const children = node.children.map((child, index) => renderNode(child, `${key}-${index}`, assetUrls))
  switch (node.name) {
    case 'b': return <strong key={key}>{children}</strong>
    case 'i': return <em key={key}>{children}</em>
    case 'u': return <u key={key}>{children}</u>
    case 's': return <s key={key}>{children}</s>
    case 'color': return <span key={key} style={{ color: /^#[0-9a-f]{3,8}$/i.test(node.attribute ?? '') ? node.attribute : undefined }}>{children}</span>
    case 'size': return <span key={key} style={{ fontSize: publicFontSizes[node.attribute ?? ''] }}>{children}</span>
    case 'font': return <span key={key} style={{ fontFamily: /^[\w -]{1,40}$/.test(node.attribute ?? '') ? node.attribute : undefined }}>{children}</span>
    case 'left': case 'center': case 'right': return <div key={key} style={{ textAlign: node.name }}>{children}</div>
    case 'heading': return <h2 key={key}>{children}</h2>
    case 'quote': return <figure className="nexus-quote" key={key}><span className="nexus-quote-mark" aria-hidden="true">“</span><blockquote>{node.attribute && <cite>{node.attribute}</cite>}{children}</blockquote></figure>
    case 'code': return <pre key={key}><code>{textContent(node.children)}</code></pre>
    case 'spoiler': return <details className="bbc-spoiler nexus-public-spoiler" key={key}><summary><span>Spoiler:</span>{' \u00a0'}<span className="bbc-spoiler-show">Show</span></summary><div className="bbc-spoiler-content">{children}</div></details>
    case 'list': {
      const Tag = node.attribute === '1' ? 'ol' : 'ul'
      return <Tag key={key}>{node.children.filter((child): child is TagNode => child.type === 'tag' && child.name === '*').map((child, index) => renderNode(child, `${key}-item-${index}`, assetUrls))}</Tag>
    }
    case '*': return <li key={key}>{withoutBoundaryNewlines(node.children).map((child, index) => renderNode(child, `${key}-${index}`, assetUrls))}</li>
    case 'url': {
      const href = safeUrl(node.attribute ?? textContent(node.children))
      return href ? <a key={key} href={href} target="_blank" rel="noreferrer">{children}</a> : <span key={key}>{children}</span>
    }
    case 'img': case 'aimg': {
      const src = safeUrl(textContent(node.children), true, assetUrls)
      if (!src) return null
      const dimensions = imageDimensions(node.attribute)
      return <img key={key} src={src} alt="" data-align={node.name === 'aimg' ? node.attribute : undefined} width={Number(dimensions.width) || undefined} height={Number(dimensions.height) || undefined} />
    }
    case 'youtube': {
      const id = textContent(node.children).replace(/[^\w-]/g, '')
      return id ? <div className="embed-placeholder" key={key}>YouTube video · {id}</div> : null
    }
    case 'video': case 'soundcloud': return <div className="embed-placeholder" key={key}>{node.name} embed · {textContent(node.children)}</div>
    case 'twitter': return <a key={key} href={`https://twitter.com/${encodeURIComponent(textContent(node.children).replace(/^@/, ''))}`} target="_blank" rel="noreferrer">@{textContent(node.children).replace(/^@/, '')}</a>
    case 'line': return <hr key={key} />
    default: return <span key={key}>{children}</span>
  }
}

export function renderBBCode(input: string, assetUrls: Record<string, string> = {}) {
  return nexusRootNodes(parseBBCode(input)).map((node, index) => renderNode(node, String(index), assetUrls))
}

export function bbcodeDiagnostics(input: string) {
  const issues: string[] = []
  const stack: string[] = []
  for (const match of input.matchAll(tokenPattern)) {
    const closing = Boolean(match[1]); const name = match[2]!.toLowerCase()
    if (!SUPPORTED_TAGS.has(name)) issues.push(`Unknown tag [${name}]`)
    else if (name === 'line' || name === '*') continue
    else if (!closing) stack.push(name)
    else if (stack.at(-1) === name) stack.pop()
    else issues.push(`Unexpected closing tag [/${name}]`)
  }
  stack.reverse().forEach((tag) => issues.push(`Missing closing tag [/${tag}]`))
  return [...new Set(issues)]
}

export const BB_CODE_COMPLETIONS = [...SUPPORTED_TAGS].filter((tag) => tag !== '*').map((tag) => ({
  label: `[${tag}]`,
  type: 'keyword',
  apply: tag === 'line' ? '[line]' : `[${tag}]\n\n[/${tag}]`,
  detail: 'Nexus BBCode',
}))
