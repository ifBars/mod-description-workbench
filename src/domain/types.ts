export type AuthoringMode = 'markdown' | 'bbcode'
export type WorkspaceLayout = 'split' | 'write' | 'preview'
export type PreviewDevice = 'desktop' | 'mobile'
export type ThemeMode = 'system' | 'dark' | 'light'
export type AuthoringToolTab = 'sections' | 'images' | 'spoiler' | 'components' | 'templates' | 'color'

export interface DescriptionDocument {
  id: string
  title: string
  mode: AuthoringMode
  content: string
  /** Exact per-mode drafts prevent a view switch from round-tripping source. */
  sources?: { [Mode in AuthoringMode]?: string | undefined } | undefined
  /** Canonical Nexus BBCode used by preview; only actual edits replace it. */
  nexusContent?: string | undefined
  createdAt: number
  updatedAt: number
}

export interface ThemeTokens {
  canvas: string
  surfaceLow: string
  surfaceRaised: string
  border: string
  text: string
  muted: string
  accent: string
  accentHover: string
  focus: string
}

export interface CustomTheme {
  id: string
  name: string
  dark: boolean
  tokens: ThemeTokens
}

export interface ImageAsset {
  id: string
  name: string
  kind: 'remote' | 'local'
  url: string | null
  mimeType: string
  size: number
  width?: number | undefined
  height?: number | undefined
  createdAt: number
}

export interface ReusableBlock {
  id: string
  name: string
  mode: AuthoringMode
  content: string
  createdAt: number
}

export type ComponentVariableType = 'text' | 'color' | 'url' | 'image' | 'choice' | 'boolean'

export interface ComponentVariable {
  id: string
  name: string
  type: ComponentVariableType
  defaultValue: string | boolean
  options?: string[] | undefined
}

export interface ComponentDefinition extends ReusableBlock {
  /** Optional for v1 workspace compatibility; normalized to [] on load/import. */
  variables?: ComponentVariable[] | undefined
}

export interface ComponentInstance {
  id: string
  definitionId: string
  documentId: string
  values: Record<string, string | boolean>
  mode: AuthoringMode
  renderedContent: string
  createdAt: number
  updatedAt: number
}

export interface WorkspacePreferences {
  theme: ThemeMode
  customThemeId: string | null
  layout: WorkspaceLayout
  splitRatio: number
  previewDevice: PreviewDevice
  previewZoom: number
  editorFontSize: number
  wordWrap: boolean
  reducedMotion: boolean
  autosaveDelayMs: number
  recoveryEnabled: boolean
  checkpointDelayMs: number
  checkpointRetention: number
}

export interface WorkspaceSnapshot {
  schemaVersion: 1
  documents: DescriptionDocument[]
  activeDocumentId: string
  preferences: WorkspacePreferences
  customThemes: CustomTheme[]
  imageAssets: ImageAsset[]
  components: ComponentDefinition[]
  componentInstances: ComponentInstance[]
  templates: ReusableBlock[]
}

export interface RecoveryCheckpoint {
  id: string
  documentId: string
  content: string
  mode: AuthoringMode
  createdAt: number
}
