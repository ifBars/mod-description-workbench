import type { DescriptionDocument, WorkspacePreferences, WorkspaceSnapshot } from './types'

const SAMPLE_MARKDOWN = `# Better Dealers

A focused quality-of-life update for Schedule I dealers.

## What it changes

- Faster dealer management
- Clearer status feedback
- Safe defaults with no save migration

:::spoiler Installation notes
Back up your save, install the latest supported loader, then place the mod in your Mods folder.
:::

> Your writing stays in this browser. Export a workspace backup whenever you want a portable copy.

**Compatibility:** Designed for the current game release.`

export const DEFAULT_PREFERENCES: WorkspacePreferences = {
  theme: 'dark',
  customThemeId: null,
  layout: 'split',
  splitRatio: 54,
  previewDevice: 'desktop',
  previewZoom: 100,
  editorFontSize: 14,
  wordWrap: true,
  reducedMotion: false,
  autosaveDelayMs: 250,
  recoveryEnabled: true,
  checkpointDelayMs: 1500,
  checkpointRetention: 50,
}

export function createDocument(title = 'Untitled description'): DescriptionDocument {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    title,
    mode: 'markdown',
    content: SAMPLE_MARKDOWN,
    sources: { markdown: SAMPLE_MARKDOWN },
    createdAt: now,
    updatedAt: now,
  }
}

export function createDefaultSnapshot(): WorkspaceSnapshot {
  const document = createDocument('Schedule I — Better Dealers')
  return {
    schemaVersion: 1,
    documents: [document],
    activeDocumentId: document.id,
    preferences: DEFAULT_PREFERENCES,
    customThemes: [],
    imageAssets: [],
    components: [],
    componentInstances: [],
    templates: [],
  }
}
