import { z } from 'zod'
import type { ComponentDefinition, ReusableBlock } from '../domain/types'
import { filePlatform, type SaveFileRequest, type SelectedFile } from '../platform/files'

export type LibraryKind = 'components' | 'templates'

const librarySchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.enum(['components', 'templates']),
  items: z.array(z.object({
    name: z.string().min(1).max(100), mode: z.enum(['markdown', 'bbcode']), content: z.string(),
    variables: z.array(z.object({ id: z.string(), name: z.string(), type: z.enum(['text', 'color', 'url', 'image', 'choice', 'boolean']), defaultValue: z.union([z.string(), z.boolean()]), options: z.array(z.string()).optional() })).optional(),
  })),
})

export function createLibraryFile(kind: LibraryKind, items: ReusableBlock[]) {
  return JSON.stringify({ schemaVersion: 1, kind, items: items.map((item) => ({ name: item.name, mode: item.mode, content: item.content, ...(kind === 'components' ? { variables: (item as ComponentDefinition).variables ?? [] } : {}) })) }, null, 2)
}

async function selectedFile(file: SelectedFile | File): Promise<SelectedFile> {
  if (file instanceof File) return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }
  return file
}

export const LIBRARY_FILTERS = [{ name: 'Mod Description Library', extensions: ['json'] }]

export async function readLibraryFile(input: SelectedFile | File, expectedKind: LibraryKind) {
  let value: unknown
  try { value = JSON.parse(new TextDecoder().decode((await selectedFile(input)).bytes)) } catch { throw new Error(`This is not a valid ${expectedKind} library.`) }
  const parsed = librarySchema.safeParse(value)
  if (!parsed.success || parsed.data.kind !== expectedKind) throw new Error(`This is not a valid ${expectedKind} library.`)
  return parsed.data.items
}

export function createLibraryExport(kind: LibraryKind, items: ReusableBlock[]): SaveFileRequest {
  return {
    filename: `mod-description-${kind}.mdw-${kind}.json`,
    mimeType: 'application/json;charset=utf-8',
    bytes: new TextEncoder().encode(createLibraryFile(kind, items)),
    filters: LIBRARY_FILTERS,
  }
}

export async function saveLibrary(kind: LibraryKind, items: ReusableBlock[]) {
  return (await filePlatform()).saveFile(createLibraryExport(kind, items))
}
