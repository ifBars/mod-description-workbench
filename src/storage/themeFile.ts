import type { CustomTheme } from '../domain/types'
import { filePlatform, type SaveFileRequest, type SelectedFile } from '../platform/files'

const requiredTokens = ['canvas', 'surfaceLow', 'surfaceRaised', 'border', 'text', 'muted', 'accent', 'accentHover', 'focus'] as const
export const THEME_FILTERS = [{ name: 'Mod Description Theme', extensions: ['json'] }]

async function selectedFile(file: SelectedFile | File): Promise<SelectedFile> {
  if (file instanceof File) return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }
  return file
}

export async function readThemeFile(input: SelectedFile | File): Promise<CustomTheme> {
  let value: unknown
  try { value = JSON.parse(new TextDecoder().decode((await selectedFile(input)).bytes)) } catch { throw new Error('Invalid theme file.') }
  if (!value || typeof value !== 'object') throw new Error('Invalid theme file.')
  const theme = value as { name?: unknown; dark?: unknown; tokens?: unknown }
  if ((theme.name !== undefined && typeof theme.name !== 'string') || (theme.dark !== undefined && typeof theme.dark !== 'boolean')) throw new Error('Invalid theme file.')
  const tokens = theme.tokens as Record<string, unknown> | undefined
  if (!tokens || !requiredTokens.every((key) => typeof tokens[key] === 'string' && /^#[0-9a-f]{6}$/i.test(tokens[key]))) throw new Error('Invalid theme file.')
  return { id: crypto.randomUUID(), name: theme.name?.slice(0, 60) || 'Imported theme', dark: theme.dark ?? true, tokens: tokens as unknown as CustomTheme['tokens'] }
}

export function createThemeExport(theme: CustomTheme): SaveFileRequest {
  return {
    filename: `${theme.name.replace(/\W+/g, '-').toLowerCase()}.mdw-theme.json`,
    mimeType: 'application/json;charset=utf-8',
    bytes: new TextEncoder().encode(JSON.stringify(theme, null, 2)),
    filters: THEME_FILTERS,
  }
}

export async function saveTheme(theme: CustomTheme) {
  return (await filePlatform()).saveFile(createThemeExport(theme))
}
