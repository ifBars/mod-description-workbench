import { z } from 'zod'
import type { ComponentDefinition, ReusableBlock } from '../domain/types'

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

export async function readLibraryFile(file: File, expectedKind: LibraryKind) {
  let value: unknown
  try { value = JSON.parse(await file.text()) } catch { throw new Error(`This is not a valid ${expectedKind} library.`) }
  const parsed = librarySchema.safeParse(value)
  if (!parsed.success || parsed.data.kind !== expectedKind) throw new Error(`This is not a valid ${expectedKind} library.`)
  return parsed.data.items
}

export function downloadLibrary(kind: LibraryKind, items: ReusableBlock[]) {
  const url = URL.createObjectURL(new Blob([createLibraryFile(kind, items)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `mod-description-${kind}.mdw-${kind}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
