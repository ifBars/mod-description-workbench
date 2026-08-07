import { z } from 'zod'
import type { WorkspaceSnapshot } from '../domain/types'

export const workspaceSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  documents: z.array(z.object({ id: z.string(), title: z.string(), mode: z.enum(['markdown', 'bbcode']), content: z.string(), sources: z.object({ markdown: z.string().optional(), bbcode: z.string().optional() }).optional(), nexusContent: z.string().optional(), createdAt: z.number(), updatedAt: z.number() })).min(1),
  activeDocumentId: z.string(),
  preferences: z.object({ theme: z.enum(['system', 'dark', 'light']), customThemeId: z.string().nullable(), layout: z.enum(['split', 'write', 'preview']), splitRatio: z.number().min(35).max(70).default(54), previewDevice: z.enum(['desktop', 'mobile']), previewZoom: z.number(), editorFontSize: z.number(), wordWrap: z.boolean(), reducedMotion: z.boolean(), autosaveDelayMs: z.number().min(100).max(5000).default(250), recoveryEnabled: z.boolean().default(true), checkpointDelayMs: z.number().min(1000).max(60000).default(1500), checkpointRetention: z.number().int().min(5).max(100).default(50) }),
  customThemes: z.array(z.object({ id: z.string(), name: z.string(), dark: z.boolean(), tokens: z.object({ canvas: z.string(), surfaceLow: z.string(), surfaceRaised: z.string(), border: z.string(), text: z.string(), muted: z.string(), accent: z.string(), accentHover: z.string(), focus: z.string() }) })),
  imageAssets: z.array(z.object({ id: z.string(), name: z.string(), kind: z.enum(['remote', 'local']), url: z.string().nullable(), mimeType: z.string(), size: z.number(), width: z.number().optional(), height: z.number().optional(), createdAt: z.number() })).default([]),
  components: z.array(z.object({ id: z.string(), name: z.string(), mode: z.enum(['markdown', 'bbcode']), content: z.string(), createdAt: z.number(), variables: z.array(z.object({ id: z.string(), name: z.string(), type: z.enum(['text', 'color', 'url', 'image', 'choice', 'boolean']), defaultValue: z.union([z.string(), z.boolean()]), options: z.array(z.string()).optional() })).default([]) })).default([]),
  componentInstances: z.array(z.object({ id: z.string(), definitionId: z.string(), documentId: z.string(), values: z.record(z.string(), z.union([z.string(), z.boolean()])), mode: z.enum(['markdown', 'bbcode']), renderedContent: z.string(), createdAt: z.number(), updatedAt: z.number() })).default([]),
  templates: z.array(z.object({ id: z.string(), name: z.string(), mode: z.enum(['markdown', 'bbcode']), content: z.string(), createdAt: z.number() })).default([]),
})

export function parseWorkspaceSnapshot(snapshot: unknown, errorMessage = 'Invalid workspace file.'): WorkspaceSnapshot {
  const parsed = workspaceSnapshotSchema.safeParse(snapshot)
  if (!parsed.success) throw new Error(errorMessage)
  return parsed.data
}
