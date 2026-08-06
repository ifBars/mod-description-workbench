import type { AuthoringMode } from '../domain/types'

function escapeBBCode(value: string) { return value.replace(/\[/g, '&#91;') }

function nexusColor(value: string) {
  const rgb = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  return rgb ? `#${rgb.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, '0')).join('')}` : value
}

export function markdownToBBCode(markdown: string) {
  return markdown
    .replace(/^:::spoiler(?:\s+[^\n]+)?\n([\s\S]*?)\n:::/gm, '[spoiler]$1[/spoiler]')
    .replace(/```(?:[^\n]*)\n([\s\S]*?)```/g, '[code]$1[/code]')
    .replace(/(?:^(?:[-*])\s+.+(?:\n|$))+/gm, (block) => `[list]\n${block.trimEnd().replace(/^[-*]\s+/gm, '[*]')}\n[/list]${block.endsWith('\n') ? '\n' : ''}`)
    .replace(/(?:^\d+\.\s+.+(?:\n|$))+/gm, (block) => `[list=1]\n${block.trimEnd().replace(/^\d+\.\s+/gm, '[*]')}\n[/list]${block.endsWith('\n') ? '\n' : ''}`)
    .replace(/^######\s+(.+)$/gm, '[b]$1[/b]')
    .replace(/^#####\s+(.+)$/gm, '[size=3][b]$1[/b][/size]')
    .replace(/^####\s+(.+)$/gm, '[size=3][b]$1[/b][/size]')
    .replace(/^###\s+(.+)$/gm, '[b]$1[/b]')
    .replace(/^##\s+(.+)$/gm, '[size=4]$1[/size]')
    .replace(/^#\s+(.+)$/gm, '[size=5]$1[/size]')
    .replace(/!\[[^\]]*\]\(((?:https?:\/\/|asset:\/\/)[^)]+)\)/g, '[img]$1[/img]')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '[url=$2]$1[/url]')
    .replace(/\*\*([^*]+)\*\*/g, '[b]$1[/b]')
    .replace(/~~([^~]+)~~/g, '[s]$1[/s]')
    .replace(/(?<!\*)\*(?!\s)([^*\n]+)\*(?!\*)/g, '[i]$1[/i]')
    .replace(/`([^`]+)`/g, '[i][font=Courier New]$1[/font][/i]')
    .replace(/<u>([\s\S]*?)<\/u>/gi, '[u]$1[/u]')
    .replace(/<span\s+style=["']color:\s*(#[0-9a-f]{3,8})["']>([\s\S]*?)<\/span>/gi, '[color=$1]$2[/color]')
    .replace(/^>\s?(.+)$/gm, '[quote]$1[/quote]')
    .replace(/^---+$/gm, '[line]')
}

export function bbcodeToMarkdown(bbcode: string) {
  return bbcode
    .replace(/\[size=5\]([\s\S]*?)\[\/size\]/gi, '# $1')
    .replace(/\[size=4\]([\s\S]*?)\[\/size\]/gi, '## $1')
    .replace(/\[heading\]([\s\S]*?)\[\/heading\]/gi, '## $1')
    .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '**$1**')
    .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '*$1*')
    .replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, '[$2]($1)')
    .replace(/\[img\]([\s\S]*?)\[\/img\]/gi, '![]($1)')
    .replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, '> $1')
    .replace(/\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi, ':::spoiler\n$1\n:::')
    .replace(/\[line\]/gi, '---')
    .replace(/\[list=1\]([\s\S]*?)\[\/list\]/gi, (_match, items: string) => {
      let index = 0
      return items.replace(/\[\*\]/g, () => `${++index}. `).trim()
    })
    .replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (_match, items: string) => items.replace(/\[\*\]/g, '- ').trim())
}

export function visualHTMLToBBCode(html: string) {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeBBCode(node.textContent ?? '')
    if (!(node instanceof HTMLElement)) return ''
    const content = [...node.childNodes].map(walk).join('')
    const name = node.tagName.toLowerCase()
    const wrap = (tag: string) => `[${tag}]${content}[/${tag}]`
    if (name === 'strong' || name === 'b') return wrap('b')
    if (name === 'em' || name === 'i') return wrap('i')
    if (name === 'u') return wrap('u')
    if (name === 's' || name === 'del') return wrap('s')
    if (name === 'span') {
      let styled = content
      const color = node.style.color
      const font = node.style.fontFamily.replace(/["']/g, '')
      const size = Object.entries({ '10px': '1', '13px': '2', '14px': '3', '16px': '3', '18px': '4', '24px': '5', '32px': '6' }).find(([pixels]) => node.style.fontSize === pixels)?.[1]
      if (font) styled = `[font=${font}]${styled}[/font]`
      if (size) styled = `[size=${size}]${styled}[/size]`
      if (color) styled = `[color=${nexusColor(color)}]${styled}[/color]`
      return styled
    }
    if (name === 'h1') return `[size=5]${content}[/size]\n`
    if (name === 'h2') return `[size=4]${content}[/size]\n`
    if (name === 'h3') return `[b]${content}[/b]\n`
    if (name === 'blockquote') {
      const cite = [...node.children].find((child) => child.tagName.toLowerCase() === 'cite')
      const quoteContent = [...node.childNodes].filter((child) => child !== cite).map(walk).join('')
      const author = node.dataset.cite ?? cite?.textContent
      return `[quote${author ? `=${escapeBBCode(author)}` : ''}]${quoteContent}[/quote]\n`
    }
    if (name === 'pre') return `[code]${escapeBBCode(node.textContent ?? '')}[/code]\n`
    if (name === 'code') return `[i][font=Courier New]${content}[/font][/i]`
    if (name === 'a') return `[url=${node.getAttribute('href') ?? ''}]${content}[/url]`
    if (name === 'img') {
      const dimensions = [node.getAttribute('width') ? `width=${node.getAttribute('width')}` : '', node.getAttribute('height') ? `height=${node.getAttribute('height')}` : ''].filter(Boolean).join(' ')
      return `[img${dimensions ? ` ${dimensions}` : ''}]${node.getAttribute('src') ?? ''}[/img]`
    }
    if (name === 'li') return `[*]${content}\n`
    if (name === 'ul') return `[list]\n${content}[/list]\n`
    if (name === 'ol') return `[list=1]\n${content}[/list]\n`
    if (name === 'hr') return '[line]\n'
    if (name === 'br') return '\n'
    if (name === 'details') return `[spoiler]${[...node.children].filter((child) => child.tagName.toLowerCase() !== 'summary').map(walk).join('')}[/spoiler]\n`
    if (name === 'summary') return ''
    if (name === 'p' || name === 'div') {
      const align = node.style.textAlign
      return `${align === 'center' || align === 'right' || align === 'left' ? `[${align}]${content}[/${align}]` : content}\n\n`
    }
    return content
  }
  return [...document.body.childNodes]
    .map(walk)
    .join('')
    .split(/(\[code\][\s\S]*?\[\/code\])/gi)
    .map((part, index) => index % 2 === 1 ? part : part.replace(/\n{3,}/g, '\n\n'))
    .join('')
    .trim()
}

export function convertContent(content: string, from: AuthoringMode, to: AuthoringMode) {
  if (from === to) return content
  return to === 'bbcode' ? markdownToBBCode(content) : bbcodeToMarkdown(content)
}

/** Nexus ultimately consumes BBCode. Every authoring mode passes through this
 * same compatibility boundary so equivalent source cannot drift visually. */
export function normalizeForNexus(content: string, mode: AuthoringMode) {
  return mode === 'bbcode' ? content : convertContent(content, mode, 'bbcode')
}
