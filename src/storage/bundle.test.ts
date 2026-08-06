import { createDefaultSnapshot } from '../domain/defaults'
import { createWorkspaceBundle, readWorkspaceBundle } from './bundle'
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

  it('accepts legacy JSON workspace exports', async () => {
    const snapshot = createDefaultSnapshot()
    const restored = await readWorkspaceBundle(new File([JSON.stringify(snapshot)], 'workspace.json', { type: 'application/json' }))
    expect(restored.schemaVersion).toBe(1)
  })

  it('rejects archives without a workspace manifest', async () => {
    const emptyZip = new Uint8Array([80, 75, 5, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    await expect(readWorkspaceBundle(new File([emptyZip], 'broken.mdw'))).rejects.toThrow('workspace.json')
  })
})
