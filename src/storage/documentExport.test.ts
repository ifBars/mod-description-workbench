import { describe, expect, it } from 'vitest'
import type { DescriptionDocument } from '../domain/types'
import { exportDocumentContent, safeDocumentName } from './documentExport'

const document: DescriptionDocument = {
  id: 'doc', title: 'My Nexus Mod!', mode: 'bbcode', content: '[size=5]Release[/size]\n[b]Stable[/b]',
  nexusContent: '[size=5]Release[/size]\n[b]Stable[/b]', createdAt: 1, updatedAt: 1,
}

describe('single-document exports', () => {
  it('keeps canonical Nexus BBCode exact', () => expect(exportDocumentContent(document, 'bbcode')).toBe(document.nexusContent))
  it('exports Markdown from canonical content', () => expect(exportDocumentContent(document, 'markdown')).toBe('# Release\n**Stable**'))
  it('exports semantic rich HTML', () => expect(exportDocumentContent(document, 'html')).toContain('<h1>Release</h1>'))
  it('exports readable plain text', () => expect(exportDocumentContent(document, 'text')).toBe('Release\nStable'))
  it('creates safe filenames', () => expect(safeDocumentName('  My Nexus Mod!  ')).toBe('my-nexus-mod'))
})
