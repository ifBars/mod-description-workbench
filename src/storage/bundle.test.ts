import { createDefaultSnapshot } from '../domain/defaults'
import { createWorkspaceBundle, createWorkspaceExport, parseWorkspaceBundle, readWorkspaceBundle, WORKSPACE_EXPORT_FILTERS, WORKSPACE_IMPORT_FILTERS } from './bundle'
import { strToU8, zipSync } from 'fflate'
import { loadAsset, saveAsset } from './database'

describe('portable workspace bundles', () => {
  it('round-trips documents, settings, themes, blocks, and remote image metadata', async () => {
    const snapshot = createDefaultSnapshot()
    snapshot.customThemes.push({ id: 'theme-1', name: 'Test', dark: true, tokens: { canvas: '#111111', surfaceLow: '#222222', surfaceRaised: '#333333', border: '#444444', text: '#eeeeee', muted: '#aaaaaa', accent: '#dd7733', accentHover: '#ee8844', focus: '#5599cc' } })
    snapshot.components.push({ id: 'component-1', name: 'Callout', mode: 'bbcode', content: '[quote]Safe[/quote]', createdAt: 1 })
    snapshot.templates.push({ id: 'template-1', name: 'Template', mode: 'markdown', content: '# Template', createdAt: 1 })
    snapshot.imageAssets.push({ id: 'remote-1', name: 'Banner', kind: 'remote', url: 'https://example.com/banner.png', mimeType: 'image/remote', size: 0, createdAt: 1 })

    const blob = await createWorkspaceBundle(snapshot)
    const restored = await readWorkspaceBundle(new File([blob], 'workspace.mdw'))

    expect(restored.documents[0]?.title).toBe('Schedule I — Better Dealers')
    expect(restored.customThemes[0]?.name).toBe('Test')
    expect(restored.components[0]?.content).toBe('[quote]Safe[/quote]')
    expect(restored.templates[0]?.name).toBe('Template')
    expect(restored.imageAssets[0]?.url).toBe('https://example.com/banner.png')
  })

  it('packs and restores local image bytes', async () => {
    const snapshot = createDefaultSnapshot()
    const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3])
    snapshot.imageAssets.push({ id: 'local-1', name: 'local.png', kind: 'local', url: null, mimeType: 'image/png', size: bytes.length, createdAt: 1 })
    await saveAsset('local-1', await new Response(bytes, { headers: { 'Content-Type': 'image/png' } }).blob())

    const bundle = await createWorkspaceBundle(snapshot)
    await readWorkspaceBundle(new File([bundle], 'workspace.mdw'))
    const restored = await loadAsset('local-1')

    expect(restored?.type).toBe('image/png')
    expect(new Uint8Array(await new Response(restored!).arrayBuffer())).toEqual(bytes)
  })

  it('creates a native-safe binary export payload without changing archive bytes', async () => {
    const snapshot = createDefaultSnapshot()
    const payload = await createWorkspaceExport(snapshot)
    expect(payload).toMatchObject({ filename: 'mod-description-workspace.mdw', mimeType: 'application/vnd.mod-description-workbench' })
    expect(payload.filters).toEqual(WORKSPACE_EXPORT_FILTERS)
    expect(payload.filters).toEqual([{ name: 'Mod Description Workspace', extensions: ['mdw'] }])
    expect(payload.bytes.byteLength).toBeGreaterThan(0)
    await expect(readWorkspaceBundle({ name: payload.filename, bytes: payload.bytes })).resolves.toMatchObject({ schemaVersion: 1 })
  })

  it('keeps legacy JSON available only to workspace imports', () => {
    expect(WORKSPACE_IMPORT_FILTERS).toEqual([
      { name: 'Mod Description Workspace', extensions: ['mdw'] },
      { name: 'Workspace JSON', extensions: ['json'] },
    ])
    expect(WORKSPACE_EXPORT_FILTERS).toEqual([{ name: 'Mod Description Workspace', extensions: ['mdw'] }])
  })

  it('accepts legacy JSON workspace exports', async () => {
    const snapshot = createDefaultSnapshot()
    const restored = await readWorkspaceBundle(new File([JSON.stringify(snapshot)], 'workspace.json', { type: 'application/json' }))
    expect(restored.schemaVersion).toBe(1)
  })

  it('rejects archives without a workspace manifest', async () => {
    const emptyZip = new Uint8Array([80, 75, 5, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    await expect(readWorkspaceBundle(new File([emptyZip], 'broken.mdw'))).rejects.toThrow('workspace.json')
  })

  it('rejects a bundle that declares a missing local asset before writing anything', () => {
    const snapshot = createDefaultSnapshot()
    snapshot.imageAssets.push({ id: 'missing-local', name: 'missing.png', kind: 'local', url: null, mimeType: 'image/png', size: 10, createdAt: 1 })
    const bytes = zipSync({ 'workspace.json': strToU8(JSON.stringify(snapshot)) })

    expect(() => parseWorkspaceBundle({ name: 'missing.mdw', bytes })).toThrow('missing local asset')
  })

  it('rejects invalid workspace data before it can be applied', async () => {
    await expect(readWorkspaceBundle({ name: 'invalid.json', bytes: new TextEncoder().encode('{"schemaVersion":1}') })).rejects.toThrow('Invalid workspace file')
  })

  it('rejects a workspace whose active document is not declared', async () => {
    const snapshot = createDefaultSnapshot()
    snapshot.activeDocumentId = 'missing-document'

    await expect(readWorkspaceBundle(new File([JSON.stringify(snapshot)], 'invalid.json'))).rejects.toThrow('Invalid workspace file')
  })
})
