import { describe, expect, it } from 'vitest'
import { applySourceCommand } from './editorCommands'

describe('source editor commands', () => {
  it.each([
    ['markdown', 'bold', 'hello', 0, 5, '**hello**'],
    ['bbcode', 'bold', 'hello', 0, 5, '[b]hello[/b]'],
    ['markdown', 'link', 'Nexus', 0, 5, '[Nexus](https://example.com)'],
    ['bbcode', 'orderedList', 'first', 0, 5, '[list=1]\n[*]first\n[/list]'],
  ] as const)('applies %s %s to a selection', (mode, command, value, anchor, head, expected) => {
    expect(applySourceCommand(value, anchor, head, mode, command).value).toBe(expected)
  })

  it('inserts and selects a useful placeholder for an empty selection', () => {
    const result = applySourceCommand('Start ', 6, 6, 'markdown', 'italic')
    expect(result.value).toBe('Start *italic text*')
    expect(result.value.slice(result.anchor, result.head)).toBe('italic text')
  })

  it('preserves a backwards selection', () => {
    const result = applySourceCommand('hello', 5, 0, 'bbcode', 'underline')
    expect(result.value).toBe('[u]hello[/u]')
    expect(result.value.slice(result.anchor, result.head)).toBe('hello')
  })

  it.each([
    ['[b]bold[/b]', 'bold'], ['**bold**', 'bold'], ['<u>under</u>', 'under'], ['~~gone~~', 'gone'],
  ])('removes common formatting from %s', (value, expected) => {
    expect(applySourceCommand(value, 0, value.length, 'bbcode', 'removeFormatting').value).toBe(expected)
  })

  it('does not disturb content outside the selection', () => {
    expect(applySourceCommand('one two three', 4, 7, 'markdown', 'code').value).toBe('one `two` three')
  })
})
