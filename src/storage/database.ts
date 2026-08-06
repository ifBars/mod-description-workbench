import { openDB, type DBSchema } from 'idb'
import type { RecoveryCheckpoint, WorkspaceSnapshot } from '../domain/types'

interface ModDescriptionWorkbenchDatabase extends DBSchema {
  workspace: {
    key: 'current'
    value: WorkspaceSnapshot
  }
  checkpoints: {
    key: string
    value: RecoveryCheckpoint
    indexes: { 'by-document': string; 'by-created': number }
  }
  assets: {
    key: string
    value: Blob
  }
}

const database = openDB<ModDescriptionWorkbenchDatabase>('mod-description-workbench', 2, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      db.createObjectStore('workspace')
      const checkpoints = db.createObjectStore('checkpoints', { keyPath: 'id' })
      checkpoints.createIndex('by-document', 'documentId')
      checkpoints.createIndex('by-created', 'createdAt')
    }
    if (oldVersion < 2) db.createObjectStore('assets')
  },
})

export async function loadWorkspace() {
  return (await database).get('workspace', 'current')
}

export async function saveWorkspace(snapshot: WorkspaceSnapshot) {
  await (await database).put('workspace', snapshot, 'current')
}

export async function saveCheckpoint(checkpoint: RecoveryCheckpoint, retention = 50) {
  const db = await database
  await db.put('checkpoints', checkpoint)
  const all = await db.getAllFromIndex('checkpoints', 'by-created')
  const stale = all.slice(0, Math.max(0, all.length - retention))
  await Promise.all(stale.map((entry) => db.delete('checkpoints', entry.id)))
}

export async function listCheckpoints(documentId: string) {
  return (await database).getAllFromIndex('checkpoints', 'by-document', documentId)
}

export async function saveAsset(id: string, blob: Blob) { await (await database).put('assets', blob, id) }
export async function loadAsset(id: string) { return (await database).get('assets', id) }
export async function deleteAsset(id: string) { await (await database).delete('assets', id) }

export async function clearAllData() {
  const db = await database
  const transaction = db.transaction(['workspace', 'checkpoints', 'assets'], 'readwrite')
  await Promise.all([transaction.objectStore('workspace').clear(), transaction.objectStore('checkpoints').clear(), transaction.objectStore('assets').clear(), transaction.done])
}
