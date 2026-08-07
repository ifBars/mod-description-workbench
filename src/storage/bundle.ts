import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { WorkspaceSnapshot } from '../domain/types'
import { filePlatform, type SaveFileRequest, type SelectedFile } from '../platform/files'
import { loadAsset, saveAsset } from './database'
import { parseWorkspaceSnapshot } from './workspaceSnapshot'

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

export const WORKSPACE_IMPORT_FILTERS = [{ name: 'Mod Description Workspace', extensions: ['mdw'] }, { name: 'Workspace JSON', extensions: ['json'] }]
export const WORKSPACE_EXPORT_FILTERS = [{ name: 'Mod Description Workspace', extensions: ['mdw'] }]

async function selectedFile(file: SelectedFile | File): Promise<SelectedFile> {
  if (file instanceof File) return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }
  return file
}

export function parseWorkspaceBundle(file: SelectedFile) {
  if (file.name.toLowerCase().endsWith('.json')) return { snapshot: parseWorkspaceSnapshot(JSON.parse(new TextDecoder().decode(file.bytes))), assets: new Map<string, Uint8Array>() }
  const archive = unzipSync(file.bytes)
  const workspaceBytes = archive[WORKSPACE_FILE]
  if (!workspaceBytes) throw new Error('Workspace bundle is missing workspace.json')
  const snapshot = parseWorkspaceSnapshot(JSON.parse(strFromU8(workspaceBytes)))
  return { snapshot, assets: new Map((snapshot.imageAssets ?? []).filter((asset) => asset.kind === 'local').flatMap((asset) => {
    const bytes = archive[`assets/${asset.id}`]
    return bytes ? [[asset.id, bytes] as const] : []
  })) }
}

export async function readWorkspaceBundle(input: SelectedFile | File): Promise<WorkspaceSnapshot> {
  const parsed = parseWorkspaceBundle(await selectedFile(input))
  await Promise.all((parsed.snapshot.imageAssets ?? []).filter((asset) => asset.kind === 'local').map(async (asset) => {
    const bytes = parsed.assets.get(asset.id)
    if (bytes) await saveAsset(asset.id, await new Response(new Uint8Array(bytes), { headers: { 'Content-Type': asset.mimeType } }).blob())
  }))
  return parsed.snapshot
}

export async function createWorkspaceExport(snapshot: WorkspaceSnapshot): Promise<SaveFileRequest> {
  return {
    filename: 'mod-description-workspace.mdw',
    mimeType: 'application/vnd.mod-description-workbench',
    bytes: new Uint8Array(await (await createWorkspaceBundle(snapshot)).arrayBuffer()),
    filters: WORKSPACE_EXPORT_FILTERS,
  }
}

export async function saveWorkspaceBundle(snapshot: WorkspaceSnapshot) {
  return (await filePlatform()).saveFile(await createWorkspaceExport(snapshot))
}
