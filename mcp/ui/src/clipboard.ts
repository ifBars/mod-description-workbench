interface ClipboardNavigator {
  clipboard?: {
    writeText(text: string): Promise<void>
  }
}

export async function copyText(
  text: string,
  browserNavigator: ClipboardNavigator = navigator,
  browserDocument: Document = document,
) {
  try {
    if (browserNavigator.clipboard?.writeText) {
      await browserNavigator.clipboard.writeText(text)
      return
    }
  } catch {
    // Embedded MCP hosts may expose the API while denying the operation.
  }

  const textarea = browserDocument.createElement('textarea')
  textarea.value = text
  textarea.readOnly = true
  textarea.setAttribute('aria-hidden', 'true')
  Object.assign(textarea.style, {
    position: 'fixed',
    inset: '0 auto auto -9999px',
    opacity: '0',
  })
  browserDocument.body.append(textarea)

  try {
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)
    if (!browserDocument.execCommand?.('copy')) throw new Error('Clipboard write was rejected')
  } finally {
    textarea.remove()
  }
}
