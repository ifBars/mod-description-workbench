import type { DescriptionDocument } from '../domain/types'
import { bbcodeToRichHTML } from '../markup/bbcode'
import { convertContent, normalizeForNexus } from '../markup/convert'
import { filePlatform, type SaveFileRequest } from '../platform/files'

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

export function createDocumentExport(document: DescriptionDocument, format: DocumentExportFormat): SaveFileRequest {
  const extensions: Record<DocumentExportFormat, string> = { markdown: 'md', bbcode: 'bbcode.txt', html: 'html', text: 'txt' }
  const mimeTypes: Record<DocumentExportFormat, string> = { markdown: 'text/markdown', bbcode: 'text/plain', html: 'text/html', text: 'text/plain' }
  const extension = extensions[format]
  return {
    filename: `${safeDocumentName(document.title)}.${extension}`,
    mimeType: `${mimeTypes[format]};charset=utf-8`,
    bytes: new TextEncoder().encode(exportDocumentContent(document, format)),
    filters: [{ name: format === 'bbcode' ? 'Nexus BBCode' : `${format[0]!.toUpperCase()}${format.slice(1)} document`, extensions: format === 'bbcode' ? ['txt'] : [extension] }],
  }
}

export async function saveDocument(document: DescriptionDocument, format: DocumentExportFormat) {
  return (await filePlatform()).saveFile(createDocumentExport(document, format))
}
