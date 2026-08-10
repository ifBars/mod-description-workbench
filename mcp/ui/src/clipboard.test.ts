import { describe, expect, it, vi } from 'vitest'
import { copyText } from './clipboard'

function documentWithCopy(result: boolean) {
  const browserDocument = document.implementation.createHTMLDocument()
  const copy = vi.fn(() => result)
  Object.defineProperty(browserDocument, 'execCommand', { configurable: true, value: copy })
  return { browserDocument, copy }
}

describe('copyText', () => {
  it('uses the Clipboard API when the host permits it', async () => {
    const writeText = vi.fn(async () => undefined)
    const { browserDocument, copy } = documentWithCopy(true)

    await copyText('ready', { clipboard: { writeText } }, browserDocument)

    expect(writeText).toHaveBeenCalledWith('ready')
    expect(copy).not.toHaveBeenCalled()
  })

  it('falls back to a selected textarea when an embedded host rejects the Clipboard API', async () => {
    const writeText = vi.fn(async () => { throw new Error('NotAllowedError') })
    const { browserDocument, copy } = documentWithCopy(true)

    await copyText('[b]Nexus BBCode[/b]', { clipboard: { writeText } }, browserDocument)

    expect(copy).toHaveBeenCalledWith('copy')
    expect(browserDocument.querySelector('textarea')).toBeNull()
  })

  it('reports failure only when both clipboard mechanisms are rejected', async () => {
    const writeText = vi.fn(async () => { throw new Error('NotAllowedError') })
    const { browserDocument } = documentWithCopy(false)

    await expect(copyText('blocked', { clipboard: { writeText } }, browserDocument)).rejects.toThrow(
      'Clipboard write was rejected',
    )
  })
})
