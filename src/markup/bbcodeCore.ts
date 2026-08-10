export interface TagNode {
  type: 'tag'
  name: string
  attribute?: string
  children: BbNode[]
}

export interface TextNode { type: 'text'; value: string }
export type BbNode = TagNode | TextNode

export const SUPPORTED_BB_CODE_TAGS = [
  'b', 'i', 'u', 's', 'color', 'size', 'font', 'left', 'center', 'right', 'quote', 'code',
  'list', '*', 'spoiler', 'url', 'img', 'aimg', 'youtube', 'video', 'soundcloud', 'twitter', 'heading', 'line',
] as const

const supportedTags = new Set<string>(SUPPORTED_BB_CODE_TAGS)
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

    if (!supportedTags.has(name)) {
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

export function bbcodeDiagnostics(input: string) {
  const issues: string[] = []
  const stack: string[] = []
  for (const match of input.matchAll(tokenPattern)) {
    const closing = Boolean(match[1]); const name = match[2]!.toLowerCase()
    if (!supportedTags.has(name)) issues.push(`Unknown tag [${name}]`)
    else if (name === 'line' || name === '*') continue
    else if (!closing) stack.push(name)
    else if (stack.at(-1) === name) stack.pop()
    else issues.push(`Unexpected closing tag [/${name}]`)
  }
  stack.reverse().forEach((tag) => issues.push(`Missing closing tag [/${tag}]`))
  return [...new Set(issues)]
}

export const BB_CODE_COMPLETIONS = SUPPORTED_BB_CODE_TAGS.filter((tag) => tag !== '*').map((tag) => ({
  label: `[${tag}]`,
  type: 'keyword',
  apply: tag === 'line' ? '[line]' : `[${tag}]\n\n[/${tag}]`,
  detail: 'Nexus BBCode',
}))
