import type { DescriptionDocument } from '../domain/types'
import { bbcodeToRichHTML } from '../markup/bbcode'
import { convertContent, normalizeForNexus } from '../markup/convert'

export type DocumentExportFormat = 'markdown' | 'bbcode' | 'html' | 'text'

export function exportDocumentContent(document: DescriptionDocument, format: DocumentExportFormat) {
  const nexus = document.nexusContent ?? normalizeForNexus(document.content, document.mode)
  if (format === 'bbcode') return nexus
  if (format === 'markdown') return document.sources?.markdown ?? convertContent(nexus, 'bbcode', 'markdown')
  const html = bbcodeToRichHTML(nexus)
  if (format === 'html') return html
  return new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, '\n'), 'text/html').body.textContent ?? ''
}

export function safeDocumentName(title: string) {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mod-description'
}

export function downloadDocument(document: DescriptionDocument, format: DocumentExportFormat) {
  const extensions: Record<DocumentExportFormat, string> = { markdown: 'md', bbcode: 'bbcode.txt', html: 'html', text: 'txt' }
  const mimeTypes: Record<DocumentExportFormat, string> = { markdown: 'text/markdown', bbcode: 'text/plain', html: 'text/html', text: 'text/plain' }
  const blob = new Blob([exportDocumentContent(document, format)], { type: `${mimeTypes[format]};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = `${safeDocumentName(document.title)}.${extensions[format]}`
  anchor.click()
  URL.revokeObjectURL(url)
}
