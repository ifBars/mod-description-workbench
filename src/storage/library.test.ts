import { describe, expect, it } from 'vitest'
import { createLibraryExport, createLibraryFile, readLibraryFile } from './library'

describe('portable reusable libraries', () => {
  const items = [{ id: 'id', name: 'Callout', mode: 'bbcode' as const, content: '[quote]Safe[/quote]', createdAt: 1 }]

  it('exports only portable fields', () => {
    expect(JSON.parse(createLibraryFile('components', items))).toEqual({ schemaVersion: 1, kind: 'components', items: [{ name: 'Callout', mode: 'bbcode', content: '[quote]Safe[/quote]', variables: [] }] })
  })

  it('creates an exact UTF-8 save payload', () => {
    const payload = createLibraryExport('components', items)
    expect(payload).toMatchObject({ filename: 'mod-description-components.mdw-components.json', mimeType: 'application/json;charset=utf-8', filters: [{ name: 'Mod Description Library', extensions: ['json'] }] })
    expect(new TextDecoder().decode(payload.bytes)).toBe(createLibraryFile('components', items))
  })

  it('imports a matching library', async () => {
    const file = new File([createLibraryFile('templates', items)], 'templates.json', { type: 'application/json' })
    await expect(readLibraryFile(file, 'templates')).resolves.toEqual([{ name: 'Callout', mode: 'bbcode', content: '[quote]Safe[/quote]' }])
  })

  it('rejects the wrong kind and invalid schema', async () => {
    const wrong = new File([createLibraryFile('components', items)], 'components.json', { type: 'application/json' })
    await expect(readLibraryFile(wrong, 'templates')).rejects.toThrow('valid templates')
    await expect(readLibraryFile(new File(['{}'], 'bad.json'), 'components')).rejects.toThrow('valid components')
  })

  it('preserves typed component variables', async () => {
    const typed = [{ ...items[0]!, variables: [{ id: 'accent', name: 'accent', type: 'color' as const, defaultValue: '#fb923c' }] }]
    const file = new File([createLibraryFile('components', typed)], 'components.json', { type: 'application/json' })
    await expect(readLibraryFile(file, 'components')).resolves.toMatchObject([{ variables: [{ name: 'accent', type: 'color' }] }])
  })
})
