import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { WorkspaceSnapshot } from '../domain/types'
import { loadAsset, saveAsset } from './database'

const WORKSPACE_FILE = 'workspace.json'

async function blobBytes(blob: Blob) {
  return new Uint8Array(await new Response(blob).arrayBuffer())
}

export async function createWorkspaceBundle(snapshot: WorkspaceSnapshot) {
  const files: Record<string, Uint8Array> = {
    [WORKSPACE_FILE]: strToU8(JSON.stringify(snapshot, null, 2)),
  }
  await Promise.all(snapshot.imageAssets.filter((asset) => asset.kind === 'local').map(async (asset) => {
    const blob = await loadAsset(asset.id)
    if (blob) files[`assets/${asset.id}`] = await blobBytes(blob)
  }))
  return new Blob([zipSync(files, { level: 6 })], { type: 'application/vnd.mod-description-workbench' })
}

export async function readWorkspaceBundle(file: File): Promise<WorkspaceSnapshot> {
  if (file.name.toLowerCase().endsWith('.json')) return JSON.parse(await file.text()) as WorkspaceSnapshot
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()))
  const workspaceBytes = archive[WORKSPACE_FILE]
  if (!workspaceBytes) throw new Error('Workspace bundle is missing workspace.json')
  const snapshot = JSON.parse(strFromU8(workspaceBytes)) as WorkspaceSnapshot
  await Promise.all((snapshot.imageAssets ?? []).filter((asset) => asset.kind === 'local').map(async (asset) => {
    const bytes = archive[`assets/${asset.id}`]
    if (bytes) await saveAsset(asset.id, await new Response(bytes, { headers: { 'Content-Type': asset.mimeType } }).blob())
  }))
  return snapshot
}

export async function downloadWorkspaceBundle(snapshot: WorkspaceSnapshot) {
  const url = URL.createObjectURL(await createWorkspaceBundle(snapshot))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'mod-description-workspace.mdw'
  anchor.click()
  URL.revokeObjectURL(url)
}
