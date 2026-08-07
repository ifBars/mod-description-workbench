import { createDefaultSnapshot } from '../domain/defaults'
import { loadWorkspace } from '../storage/database'
import { getWorkspaceSnapshot, workspaceActions } from './workspaceStore'

describe.sequential('workspace state transitions', () => {
  it('starts with a valid active document', () => {
    const snapshot = getWorkspaceSnapshot()
    expect(snapshot.documents.some((document) => document.id === snapshot.activeDocumentId)).toBe(true)
  })

  it('flushes the latest pending snapshot before a desktop close', async () => {
    const snapshot = createDefaultSnapshot()
    workspaceActions.replaceSnapshot(snapshot)
    workspaceActions.updateContent('Persist this before closing.')
    await workspaceActions.flushPersistence()
    await expect(loadWorkspace()).resolves.toMatchObject({ documents: [expect.objectContaining({ content: 'Persist this before closing.' })] })
  })

  it('creates and selects a new document atomically', () => {
    const before = getWorkspaceSnapshot().documents.length
    workspaceActions.createDocument()
    const after = getWorkspaceSnapshot()
    expect(after.documents).toHaveLength(before + 1)
    expect(after.documents.at(-1)?.id).toBe(after.activeDocumentId)
  })

  it('updates title, content, and mode on only the active document', () => {
    workspaceActions.updateTitle('State test')
    workspaceActions.updateContent('[b]Stored[/b]')
    workspaceActions.setMode('bbcode')
    const active = getWorkspaceSnapshot().documents.find((document) => document.id === getWorkspaceSnapshot().activeDocumentId)
    expect(active).toMatchObject({ title: 'State test', content: '[b]Stored[/b]', mode: 'bbcode' })
  })

  it('makes an actual visual edit canonical BBCode without stale projections', () => {
    const snapshot = createDefaultSnapshot()
    workspaceActions.replaceSnapshot(snapshot)
    workspaceActions.updateVisualContent('[size=5]Edited visually[/size]')
    const active = getWorkspaceSnapshot().documents[0]!
    expect(active).toMatchObject({ mode: 'bbcode', content: '[size=5]Edited visually[/size]', nexusContent: '[size=5]Edited visually[/size]' })
    expect(active.sources).toEqual({ bbcode: '[size=5]Edited visually[/size]' })
  })

  it('does not delete the only remaining document', () => {
    const snapshot = createDefaultSnapshot()
    workspaceActions.replaceSnapshot(snapshot)
    workspaceActions.deleteDocument(snapshot.activeDocumentId)
    expect(getWorkspaceSnapshot().documents).toHaveLength(1)
  })

  it('selects a safe fallback when deleting the active document', () => {
    workspaceActions.createDocument()
    const active = getWorkspaceSnapshot().activeDocumentId
    workspaceActions.deleteDocument(active)
    const snapshot = getWorkspaceSnapshot()
    expect(snapshot.documents).toHaveLength(1)
    expect(snapshot.activeDocumentId).toBe(snapshot.documents[0]?.id)
  })

  it.each([
    ['layout', { layout: 'preview' as const }],
    ['split ratio', { splitRatio: 62 }],
    ['preview zoom', { previewZoom: 85 }],
    ['font size', { editorFontSize: 17 }],
    ['word wrap', { wordWrap: false }],
    ['reduced motion', { reducedMotion: true }],
    ['autosave delay', { autosaveDelayMs: 1000 }],
    ['recovery enabled', { recoveryEnabled: false }],
    ['checkpoint delay', { checkpointDelayMs: 5000 }],
    ['checkpoint retention', { checkpointRetention: 25 }],
  ])('persists %s preferences', (_name, patch) => {
    workspaceActions.updatePreferences(patch)
    expect(getWorkspaceSnapshot().preferences).toMatchObject(patch)
  })

  it('fills recovery preferences when loading an older version-one workspace', () => {
    const snapshot = createDefaultSnapshot()
    const olderPreferences = {
      theme: snapshot.preferences.theme,
      customThemeId: snapshot.preferences.customThemeId,
      layout: snapshot.preferences.layout,
      splitRatio: snapshot.preferences.splitRatio,
      previewDevice: snapshot.preferences.previewDevice,
      previewZoom: snapshot.preferences.previewZoom,
      editorFontSize: snapshot.preferences.editorFontSize,
      wordWrap: snapshot.preferences.wordWrap,
      reducedMotion: snapshot.preferences.reducedMotion,
    }
    workspaceActions.replaceSnapshot({ ...snapshot, preferences: olderPreferences } as typeof snapshot)
    expect(getWorkspaceSnapshot().preferences).toMatchObject({ autosaveDelayMs: 250, recoveryEnabled: true, checkpointDelayMs: 1500, checkpointRetention: 50 })
  })

  it('creates and selects a custom theme', () => {
    workspaceActions.createCustomTheme(true)
    const snapshot = getWorkspaceSnapshot()
    expect(snapshot.customThemes).toHaveLength(1)
    expect(snapshot.preferences.customThemeId).toBe(snapshot.customThemes[0]?.id)
  })

  it('updates and deletes a custom theme', () => {
    const theme = getWorkspaceSnapshot().customThemes[0]!
    workspaceActions.updateCustomTheme(theme.id, { name: 'Changed theme', tokens: { ...theme.tokens, accent: '#abcdef' } })
    expect(getWorkspaceSnapshot().customThemes[0]).toMatchObject({ name: 'Changed theme', tokens: { accent: '#abcdef' } })
    workspaceActions.deleteCustomTheme(theme.id)
    expect(getWorkspaceSnapshot().customThemes).toEqual([])
    expect(getWorkspaceSnapshot().preferences.customThemeId).toBeNull()
  })

  it('stores reusable components and templates with their source mode', () => {
    workspaceActions.addComponent({ name: 'Callout', mode: 'bbcode', content: '[quote]Note[/quote]' })
    workspaceActions.addTemplate({ name: 'Full page', mode: 'markdown', content: '# Mod' })
    const snapshot = getWorkspaceSnapshot()
    expect(snapshot.components[0]).toMatchObject({ name: 'Callout', mode: 'bbcode' })
    expect(snapshot.templates[0]).toMatchObject({ name: 'Full page', mode: 'markdown' })
  })

  it('deletes reusable components and templates independently', () => {
    const snapshot = createDefaultSnapshot()
    snapshot.components.push({ id: 'component-delete', name: 'Delete me', mode: 'markdown', content: 'x', createdAt: 1 })
    snapshot.templates.push({ id: 'template-delete', name: 'Delete me', mode: 'bbcode', content: 'y', createdAt: 1 })
    workspaceActions.replaceSnapshot(snapshot)
    workspaceActions.deleteComponent('component-delete')
    expect(getWorkspaceSnapshot().components).toEqual([])
    expect(getWorkspaceSnapshot().templates).toHaveLength(1)
    workspaceActions.deleteTemplate('template-delete')
    expect(getWorkspaceSnapshot().templates).toEqual([])
  })

  it('stores remote image metadata without fetching it', () => {
    const asset = workspaceActions.addRemoteImage('Banner', 'https://example.com/banner.png')
    expect(asset.kind).toBe('remote')
    expect(getWorkspaceSnapshot().imageAssets.at(-1)).toMatchObject({ name: 'Banner', url: 'https://example.com/banner.png' })
  })

  it('replaces a remote image URL in canonical and exact source buffers', () => {
    const snapshot = createDefaultSnapshot()
    const oldUrl = 'https://example.com/old.png'
    const newUrl = 'https://example.com/new.png'
    snapshot.documents[0] = { ...snapshot.documents[0]!, mode: 'bbcode', content: `[img]${oldUrl}[/img]`, sources: { bbcode: `[img]${oldUrl}[/img]`, markdown: `![](${oldUrl})` }, nexusContent: `[img]${oldUrl}[/img]` }
    snapshot.imageAssets.push({ id: 'remote-replace', name: 'Banner', kind: 'remote', url: oldUrl, mimeType: 'image/remote', size: 0, createdAt: 1 })
    workspaceActions.replaceSnapshot(snapshot)

    workspaceActions.replaceRemoteImage('remote-replace', newUrl)
    const replaced = getWorkspaceSnapshot()
    expect(replaced.imageAssets[0]?.url).toBe(newUrl)
    expect(replaced.documents[0]?.content).toContain(newUrl)
    expect(replaced.documents[0]?.sources?.markdown).toContain(newUrl)
    expect(replaced.documents[0]?.nexusContent).toContain(newUrl)
  })

  it('imports reusable libraries with fresh identities', () => {
    const snapshot = createDefaultSnapshot()
    workspaceActions.replaceSnapshot(snapshot)
    workspaceActions.importComponents([{ name: 'Imported component', mode: 'bbcode', content: '[b]Component[/b]' }])
    workspaceActions.importTemplates([{ name: 'Imported template', mode: 'markdown', content: '# Template' }])
    const imported = getWorkspaceSnapshot()
    expect(imported.components[0]).toMatchObject({ name: 'Imported component', mode: 'bbcode' })
    expect(imported.templates[0]).toMatchObject({ name: 'Imported template', mode: 'markdown' })
    expect(imported.components[0]?.id).not.toBe(imported.templates[0]?.id)
  })

  it('reviews, applies, and detaches a linked component update', () => {
    const snapshot = createDefaultSnapshot()
    const documentId = snapshot.documents[0]!.id
    snapshot.documents[0] = { ...snapshot.documents[0]!, mode: 'bbcode', content: '[b]1.0[/b]', sources: { bbcode: '[b]1.0[/b]' }, nexusContent: '[b]1.0[/b]' }
    snapshot.components.push({ id: 'linked-definition', name: 'Release', mode: 'bbcode', content: '[b]{{version}}[/b]', variables: [{ id: 'version', name: 'version', type: 'text', defaultValue: '1.0' }], createdAt: 1 })
    snapshot.componentInstances.push({ id: 'linked-instance', definitionId: 'linked-definition', documentId, values: { version: '1.0' }, mode: 'bbcode', renderedContent: '[b]1.0[/b]', createdAt: 1, updatedAt: 1 })
    workspaceActions.replaceSnapshot(snapshot)

    workspaceActions.updateComponent('linked-definition', { content: '[color=#fb923c][b]{{version}}[/b][/color]' })
    expect(workspaceActions.applyComponentUpdate('linked-instance')).toBe(true)
    expect(getWorkspaceSnapshot().documents[0]?.content).toBe('[color=#fb923c][b]1.0[/b][/color]')
    expect(getWorkspaceSnapshot().componentInstances[0]?.renderedContent).toContain('[color=#fb923c]')
    workspaceActions.detachComponentInstance('linked-instance')
    expect(getWorkspaceSnapshot().componentInstances).toEqual([])
    expect(getWorkspaceSnapshot().documents[0]?.content).toContain('[color=#fb923c]')
  })

  it('does not overwrite source when a linked instance can no longer be located', () => {
    const snapshot = createDefaultSnapshot()
    const documentId = snapshot.documents[0]!.id
    snapshot.documents[0] = { ...snapshot.documents[0]!, mode: 'bbcode', content: 'Manually changed', sources: { bbcode: 'Manually changed' }, nexusContent: 'Manually changed' }
    snapshot.components.push({ id: 'missing-definition', name: 'Release', mode: 'bbcode', content: '[b]New[/b]', variables: [], createdAt: 1 })
    snapshot.componentInstances.push({ id: 'missing-instance', definitionId: 'missing-definition', documentId, values: {}, mode: 'bbcode', renderedContent: '[b]Old[/b]', createdAt: 1, updatedAt: 1 })
    workspaceActions.replaceSnapshot(snapshot)
    expect(workspaceActions.applyComponentUpdate('missing-instance')).toBe(false)
    expect(getWorkspaceSnapshot().documents[0]?.content).toBe('Manually changed')
  })

  it('rejects snapshots with no documents', () => {
    const invalid = { ...createDefaultSnapshot(), documents: [] }
    expect(() => workspaceActions.replaceSnapshot(invalid)).toThrow('not valid')
  })
})
