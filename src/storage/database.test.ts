import { createDefaultSnapshot } from '../domain/defaults'
import { clearAllData, listCheckpoints, loadAsset, loadWorkspace, saveAsset, saveCheckpoint, saveWorkspace } from './database'

describe('IndexedDB persistence', () => {
  it('round-trips the versioned workspace snapshot', async () => {
    const snapshot = createDefaultSnapshot()
    snapshot.documents[0]!.title = 'Persisted draft'
    await saveWorkspace(snapshot)
    expect((await loadWorkspace())?.documents[0]?.title).toBe('Persisted draft')
  })

  it('indexes recovery checkpoints by document', async () => {
    await saveCheckpoint({ id: 'checkpoint-a', documentId: 'document-a', content: 'First', mode: 'markdown', createdAt: 1 })
    await saveCheckpoint({ id: 'checkpoint-b', documentId: 'document-b', content: 'Other', mode: 'bbcode', createdAt: 2 })
    expect(await listCheckpoints('document-a')).toEqual([{ id: 'checkpoint-a', documentId: 'document-a', content: 'First', mode: 'markdown', createdAt: 1 }])
  })

  it('bounds retained recovery data to fifty entries', async () => {
    await Promise.all(Array.from({ length: 55 }, (_, index) => saveCheckpoint({ id: `retained-${index}`, documentId: 'retention-test', content: String(index), mode: 'markdown', createdAt: 10_000 + index })))
    expect((await listCheckpoints('retention-test')).length).toBeLessThanOrEqual(50)
  })

  it('uses the configured recovery retention limit', async () => {
    for (let index = 0; index < 8; index += 1) {
      await saveCheckpoint({ id: `custom-retained-${index}`, documentId: 'custom-retention', content: String(index), mode: 'markdown', createdAt: 30_000 + index }, 5)
    }
    expect(await listCheckpoints('custom-retention')).toHaveLength(5)
  })

  it('clears workspace, checkpoints, and image blobs together', async () => {
    await saveWorkspace(createDefaultSnapshot())
    await saveCheckpoint({ id: 'clear-checkpoint', documentId: 'clear-document', content: 'Draft', mode: 'markdown', createdAt: 20_000 })
    await saveAsset('clear-asset', new Blob(['image'], { type: 'image/png' }))
    await clearAllData()
    expect(await loadWorkspace()).toBeUndefined()
    expect(await listCheckpoints('clear-document')).toEqual([])
    expect(await loadAsset('clear-asset')).toBeUndefined()
  })
})
