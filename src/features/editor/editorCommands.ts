import type { AuthoringMode } from '../../domain/types'

export type EditorCommand = 'bold' | 'italic' | 'underline' | 'strike' | 'heading' | 'quote' | 'code' | 'bulletList' | 'orderedList' | 'link' | 'removeFormatting'

export interface EditorHandle {
  insert: (content: string) => void
  run: (command: EditorCommand) => void
}

const sourcePairs: Record<AuthoringMode, Record<Exclude<EditorCommand, 'removeFormatting'>, [string, string, string]>> = {
  markdown: {
    bold: ['**', '**', 'bold text'], italic: ['*', '*', 'italic text'], underline: ['[u]', '[/u]', 'underlined text'],
    strike: ['~~', '~~', 'struck text'], heading: ['## ', '', 'Heading'], quote: ['> ', '', 'Quote'], code: ['`', '`', 'code'],
    bulletList: ['- ', '', 'List item'], orderedList: ['1. ', '', 'List item'], link: ['[', '](https://example.com)', 'link text'],
  },
  bbcode: {
    bold: ['[b]', '[/b]', 'bold text'], italic: ['[i]', '[/i]', 'italic text'], underline: ['[u]', '[/u]', 'underlined text'],
    strike: ['[s]', '[/s]', 'struck text'], heading: ['[size=4]', '[/size]', 'Heading'], quote: ['[quote]', '[/quote]', 'Quote'], code: ['[code]', '[/code]', 'code'],
    bulletList: ['[list]\n[*]', '\n[/list]', 'List item'], orderedList: ['[list=1]\n[*]', '\n[/list]', 'List item'], link: ['[url=https://example.com]', '[/url]', 'link text'],
  },
}

export interface SourceEdit { value: string; anchor: number; head: number }

export function applySourceCommand(value: string, anchor: number, head: number, mode: AuthoringMode, command: EditorCommand): SourceEdit {
  const from = Math.min(anchor, head)
  const to = Math.max(anchor, head)
  const selected = value.slice(from, to)
  if (command === 'removeFormatting') {
    const cleaned = selected.replace(/\[(?:\/?[a-z*]+)(?:=[^\]]+)?\]/gi, '').replace(/(?:\*\*|__|~~|`|<\/?u>)/gi, '')
    return { value: value.slice(0, from) + cleaned + value.slice(to), anchor: from, head: from + cleaned.length }
  }
  const [before, after, placeholder] = sourcePairs[mode][command]
  const inner = selected || placeholder
  const replacement = before + inner + after
  const selectionStart = from + before.length
  return { value: value.slice(0, from) + replacement + value.slice(to), anchor: selectionStart, head: selectionStart + inner.length }
}
