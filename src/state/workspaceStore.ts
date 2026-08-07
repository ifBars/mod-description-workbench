import { useSyncExternalStore } from 'react'
import { createDefaultSnapshot, createDocument } from '../domain/defaults'
import { createCustomTheme } from '../domain/themes'
import type { AuthoringMode, AuthoringToolTab, ComponentDefinition, ComponentVariable, CustomTheme, ImageAsset, PreviewDevice, ReusableBlock, ThemeMode, WorkspaceLayout, WorkspacePreferences, WorkspaceSnapshot } from '../domain/types'
import { clearAllData, deleteAsset, loadAsset, loadWorkspace, saveAsset, saveCheckpoint, saveWorkspace } from '../storage/database'
import { convertContent, normalizeForNexus } from '../markup/convert'
import { imageUsageCount, validateLocalImage } from '../domain/images'
import { componentUpdate } from '../domain/components'
import { parseWorkspaceSnapshot } from '../storage/workspaceSnapshot'

type SaveState = 'saved' | 'saving' | 'error'
type Screen = 'workspace' | 'settings'

interface WorkspaceState extends WorkspaceSnapshot {
  hydrated: boolean
  saveState: SaveState
  saveError: string | undefined
  screen: Screen
  toolsOpen: boolean
  toolTab: AuthoringToolTab
  documentsOpen: boolean
  assetObjectUrls: Record<string, string>
}

let state: WorkspaceState = {
  ...createDefaultSnapshot(),
  hydrated: false,
  saveState: 'saved',
  saveError: undefined,
  screen: 'workspace',
  toolsOpen: false,
  toolTab: 'images',
  documentsOpen: false,
  assetObjectUrls: {},
}
const listeners = new Set<() => void>()
let saveTimer: ReturnType<typeof setTimeout> | undefined
let checkpointTimer: ReturnType<typeof setTimeout> | undefined
let queuedWorkspaceWrite: Promise<void> = Promise.resolve()
let saveVersion = 0

function emit() {
  listeners.forEach((listener) => listener())
}

function serializableSnapshot(): WorkspaceSnapshot {
  return {
    schemaVersion: 1,
    documents: state.documents,
    activeDocumentId: state.activeDocumentId,
    preferences: state.preferences,
    customThemes: state.customThemes,
    imageAssets: state.imageAssets,
    components: state.components,
    componentInstances: state.componentInstances,
    templates: state.templates,
  }
}

function setSaveError(message: string) {
  state = { ...state, saveState: 'error', saveError: message }
  emit()
}

function persistWorkspace(snapshot: WorkspaceSnapshot) {
  const version = ++saveVersion
  state = { ...state, saveState: 'saving' }
  emit()
  const write = queuedWorkspaceWrite.then(() => saveWorkspace(snapshot))
  queuedWorkspaceWrite = write.catch(() => undefined)
  return write.then(() => {
    if (version !== saveVersion) return
    state = { ...state, saveState: 'saved', saveError: undefined }
    emit()
  }).catch((error) => {
    if (version === saveVersion) setSaveError('Could not save locally. Try again.')
    throw error
  })
}

function scheduleSave(checkpoint = false) {
  state = { ...state, saveState: 'saving', saveError: undefined }
  emit()
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = undefined
    void persistWorkspace(serializableSnapshot()).catch(() => undefined)
  }, state.preferences.autosaveDelayMs)

  if (!state.preferences.recoveryEnabled) {
    clearTimeout(checkpointTimer)
  } else if (checkpoint) {
    clearTimeout(checkpointTimer)
    checkpointTimer = setTimeout(() => {
      checkpointTimer = undefined
      const document = getActiveDocument()
      void saveCheckpoint({
        id: crypto.randomUUID(), documentId: document.id, content: document.content,
        mode: document.mode, createdAt: Date.now(),
      }, state.preferences.checkpointRetention).catch(() => setSaveError('Could not save locally. Try again.'))
    }, state.preferences.checkpointDelayMs)
  }
}

function update(mutator: (current: WorkspaceState) => WorkspaceState, persist = true, checkpoint = false) {
  state = mutator(state)
  emit()
  if (persist) scheduleSave(checkpoint)
}

function getActiveDocument() {
  return state.documents.find((document) => document.id === state.activeDocumentId) ?? state.documents[0]!
}

function replaceDocumentReference(document: WorkspaceSnapshot['documents'][number], from: string, to: string) {
  const replace = (value: string | undefined) => value?.split(from).join(to)
  const sources = document.sources ? Object.fromEntries(Object.entries(document.sources).map(([mode, value]) => [mode, replace(value)])) as typeof document.sources : undefined
  const content = replace(document.content) ?? document.content
  const nexusContent = replace(document.nexusContent)
  if (content === document.content && nexusContent === document.nexusContent && JSON.stringify(sources) === JSON.stringify(document.sources)) return document
  return { ...document, content, sources, nexusContent, updatedAt: Date.now() }
}

function replaceFirst(value: string, from: string, to: string) {
  const index = value.indexOf(from)
  return index < 0 ? { value, replaced: false } : { value: `${value.slice(0, index)}${to}${value.slice(index + from.length)}`, replaced: true }
}

async function localImageDimensions(file: File) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      const dimensions = { width: bitmap.width, height: bitmap.height }
      bitmap.close()
      return dimensions
    } catch { /* Fall back to the browser image decoder below. */ }
  }
  if (typeof window === 'undefined' || typeof window.Image !== 'function') return {}
  const url = URL.createObjectURL(file)
  return new Promise<{ width?: number; height?: number }>((resolve) => {
    const image = new window.Image()
    const finish = (dimensions: { width?: number; height?: number }) => { URL.revokeObjectURL(url); resolve(dimensions) }
    image.onload = () => finish({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => finish({})
    image.src = url
  })
}

const hydration = loadWorkspace().then((saved) => {
  let snapshot: WorkspaceSnapshot | undefined
  try { snapshot = parseWorkspaceSnapshot(saved) } catch { /* Start from a fresh workspace when persisted data is invalid. */ }
  state = snapshot
    ? { ...state, ...snapshot, hydrated: true }
    : { ...state, hydrated: true }
  emit()
  if (snapshot) {
    void Promise.all(snapshot.imageAssets.filter((asset) => asset.kind === 'local').map(async (asset) => {
      const blob = await loadAsset(asset.id)
      return blob ? [asset.id, URL.createObjectURL(blob)] as const : null
    })).then((entries) => {
      state = { ...state, assetObjectUrls: Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null)) }
      emit()
    })
  }
}).catch(() => {
  state = { ...state, hydrated: true, saveState: 'error', saveError: 'Could not load local workspace data.' }
  emit()
})

export const workspaceActions = {
  updateContent(content: string) {
    update((current) => ({
      ...current,
      documents: current.documents.map((document) => document.id === current.activeDocumentId
        ? { ...document, content, sources: { [document.mode]: content }, nexusContent: normalizeForNexus(content, document.mode), updatedAt: Date.now() }
        : document),
    }), true, true)
  },
  updateVisualContent(content: string) {
    update((current) => ({
      ...current,
      documents: current.documents.map((document) => document.id === current.activeDocumentId
        ? { ...document, mode: 'bbcode', content, sources: { bbcode: content }, nexusContent: content, updatedAt: Date.now() }
        : document),
    }), true, true)
  },
  updateTitle(title: string) {
    update((current) => ({
      ...current,
      documents: current.documents.map((document) => document.id === current.activeDocumentId
        ? { ...document, title, updatedAt: Date.now() }
        : document),
    }))
  },
  setMode(mode: AuthoringMode) {
    update((current) => ({
      ...current,
      documents: current.documents.map((document) => document.id === current.activeDocumentId
        ? (() => {
            if (document.mode === mode) return document
            const sources = { ...document.sources, [document.mode]: document.content }
            const content = sources[mode] ?? convertContent(document.content, document.mode, mode)
            return {
              ...document,
              mode,
              content,
              sources: { ...sources, [mode]: content },
              nexusContent: document.nexusContent ?? normalizeForNexus(document.content, document.mode),
              updatedAt: Date.now(),
            }
          })()
        : document),
    }))
  },
  restoreContent(content: string, mode: AuthoringMode) {
    update((current) => ({
      ...current,
      documents: current.documents.map((document) => document.id === current.activeDocumentId
        ? { ...document, mode, content, sources: { [mode]: content }, nexusContent: normalizeForNexus(content, mode), updatedAt: Date.now() }
        : document),
    }), true, true)
  },
  createDocument() {
    update((current) => {
      const document = createDocument()
      return { ...current, documents: [...current.documents, document], activeDocumentId: document.id }
    })
  },
  selectDocument(id: string) { update((current) => ({ ...current, activeDocumentId: id })) },
  deleteDocument(id: string) {
    update((current) => {
      if (current.documents.length === 1) return current
      const documents = current.documents.filter((document) => document.id !== id)
      return { ...current, documents, activeDocumentId: current.activeDocumentId === id ? documents[0]!.id : current.activeDocumentId }
    })
  },
  setLayout(layout: WorkspaceLayout) { update((current) => ({ ...current, preferences: { ...current.preferences, layout } })) },
  setPreviewDevice(previewDevice: PreviewDevice) { update((current) => ({ ...current, preferences: { ...current.preferences, previewDevice } })) },
  setTheme(theme: ThemeMode) { update((current) => ({ ...current, preferences: { ...current.preferences, theme, customThemeId: null } })) },
  updatePreferences(preferences: Partial<WorkspacePreferences>) {
    if ('recoveryEnabled' in preferences || 'checkpointDelayMs' in preferences) clearTimeout(checkpointTimer)
    update((current) => ({ ...current, preferences: { ...current.preferences, ...preferences } }))
  },
  setScreen(screen: Screen) { update((current) => ({ ...current, screen }), false) },
  toggleTools(open?: boolean) { update((current) => ({ ...current, toolsOpen: open ?? !current.toolsOpen }), false) },
  openTools(toolTab: AuthoringToolTab = 'images') { update((current) => ({ ...current, toolsOpen: true, toolTab }), false) },
  toggleDocuments(open?: boolean) { update((current) => ({ ...current, documentsOpen: open ?? !current.documentsOpen }), false) },
  addCustomTheme(theme: CustomTheme) { update((current) => ({ ...current, customThemes: [...current.customThemes, theme] })) },
  createCustomTheme(dark = true) {
    const theme = createCustomTheme(dark)
    update((current) => ({
      ...current,
      customThemes: [...current.customThemes, theme],
      preferences: { ...current.preferences, customThemeId: theme.id, theme: dark ? 'dark' : 'light' },
    }))
  },
  selectCustomTheme(id: string) {
    const theme = state.customThemes.find((candidate) => candidate.id === id)
    if (!theme) return
    update((current) => ({ ...current, preferences: { ...current.preferences, customThemeId: id, theme: theme.dark ? 'dark' : 'light' } }))
  },
  updateCustomTheme(id: string, patch: Partial<CustomTheme>) {
    update((current) => ({ ...current, customThemes: current.customThemes.map((theme) => theme.id === id ? { ...theme, ...patch, tokens: patch.tokens ? { ...theme.tokens, ...patch.tokens } : theme.tokens } : theme) }))
  },
  deleteCustomTheme(id: string) {
    update((current) => ({ ...current, customThemes: current.customThemes.filter((theme) => theme.id !== id), preferences: { ...current.preferences, customThemeId: current.preferences.customThemeId === id ? null : current.preferences.customThemeId } }))
  },
  addRemoteImage(name: string, url: string) {
    const asset: ImageAsset = { id: crypto.randomUUID(), name, kind: 'remote', url, mimeType: 'image/remote', size: 0, createdAt: Date.now() }
    update((current) => ({ ...current, imageAssets: [...current.imageAssets, asset] }))
    return asset
  },
  async addLocalImage(file: File) {
    const validation = validateLocalImage(file)
    if (validation) throw new Error(validation)
    const asset: ImageAsset = { id: crypto.randomUUID(), name: file.name, kind: 'local', url: null, mimeType: file.type, size: file.size, ...await localImageDimensions(file), createdAt: Date.now() }
    await saveAsset(asset.id, file)
    const objectUrl = URL.createObjectURL(file)
    update((current) => ({ ...current, imageAssets: [...current.imageAssets, asset], assetObjectUrls: { ...current.assetObjectUrls, [asset.id]: objectUrl } }))
    return asset
  },
  async deleteImage(id: string) {
    await deleteAsset(id)
    const objectUrl = state.assetObjectUrls[id]
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    update((current) => {
      const assetObjectUrls = { ...current.assetObjectUrls }
      delete assetObjectUrls[id]
      return { ...current, imageAssets: current.imageAssets.filter((asset) => asset.id !== id), assetObjectUrls }
    })
  },
  replaceRemoteImage(id: string, url: string) {
    if (!/^https:\/\//i.test(url)) throw new Error('Remote image URLs must use HTTPS.')
    update((current) => {
      const asset = current.imageAssets.find((candidate) => candidate.id === id && candidate.kind === 'remote')
      if (!asset?.url) return current
      return {
        ...current,
        documents: current.documents.map((document) => replaceDocumentReference(document, asset.url!, url)),
        imageAssets: current.imageAssets.map((candidate) => candidate.id === id ? { ...candidate, url } : candidate),
      }
    }, true, true)
  },
  async replaceLocalImage(id: string, file: File) {
    const validation = validateLocalImage(file)
    if (validation) throw new Error(validation)
    const existing = state.imageAssets.find((asset) => asset.id === id && asset.kind === 'local')
    if (!existing) throw new Error('Local image not found.')
    await saveAsset(id, file)
    const previousUrl = state.assetObjectUrls[id]
    if (previousUrl) URL.revokeObjectURL(previousUrl)
    const objectUrl = URL.createObjectURL(file)
    const dimensions = await localImageDimensions(file)
    update((current) => ({
      ...current,
      imageAssets: current.imageAssets.map((asset) => asset.id === id ? { ...asset, name: file.name, mimeType: file.type, size: file.size, width: undefined, height: undefined, ...dimensions } : asset),
      assetObjectUrls: { ...current.assetObjectUrls, [id]: objectUrl },
    }))
  },
  async deleteUnusedImages() {
    const unused = state.imageAssets.filter((asset) => imageUsageCount(state.documents, asset) === 0)
    await Promise.all(unused.filter((asset) => asset.kind === 'local').map((asset) => deleteAsset(asset.id)))
    unused.forEach((asset) => {
      const objectUrl = state.assetObjectUrls[asset.id]
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    })
    const ids = new Set(unused.map((asset) => asset.id))
    update((current) => ({
      ...current,
      imageAssets: current.imageAssets.filter((asset) => !ids.has(asset.id)),
      assetObjectUrls: Object.fromEntries(Object.entries(current.assetObjectUrls).filter(([id]) => !ids.has(id))),
    }))
    return unused.length
  },
  addComponent(block: Omit<ReusableBlock, 'id' | 'createdAt'> & { variables?: ComponentVariable[] }) {
    update((current) => ({ ...current, components: [...current.components, { ...block, variables: block.variables ?? [], id: crypto.randomUUID(), createdAt: Date.now() }] }))
  },
  updateComponent(id: string, patch: Partial<Pick<ComponentDefinition, 'name' | 'mode' | 'content' | 'variables'>>) {
    update((current) => ({ ...current, components: current.components.map((block) => block.id === id ? { ...block, ...patch } : block) }))
  },
  deleteComponent(id: string) { update((current) => ({ ...current, components: current.components.filter((block) => block.id !== id), componentInstances: current.componentInstances.filter((instance) => instance.definitionId !== id) })) },
  importComponents(blocks: Array<Omit<ComponentDefinition, 'id' | 'createdAt'>>) {
    update((current) => ({ ...current, components: [...current.components, ...blocks.map((block) => ({ ...block, variables: block.variables ?? [], id: crypto.randomUUID(), createdAt: Date.now() }))] }))
  },
  linkComponentInstance(instance: { definitionId: string; documentId: string; values: Record<string, string | boolean>; mode: AuthoringMode; renderedContent: string }) {
    const now = Date.now()
    update((current) => ({ ...current, componentInstances: [...current.componentInstances, { ...instance, id: crypto.randomUUID(), createdAt: now, updatedAt: now }] }))
  },
  applyComponentUpdate(id: string) {
    let applied = false
    update((current) => {
      const instance = current.componentInstances.find((candidate) => candidate.id === id)
      const definition = instance && current.components.find((candidate) => candidate.id === instance.definitionId)
      if (!instance || !definition) return current
      const nextRendered = componentUpdate(definition, instance)
      if (nextRendered === instance.renderedContent) return current
      const documents = current.documents.map((document) => {
        if (document.id !== instance.documentId) return document
        let changed = false
        const oldContent = convertContent(instance.renderedContent, instance.mode, document.mode)
        const newContent = convertContent(nextRendered, instance.mode, document.mode)
        const contentResult = replaceFirst(document.content, oldContent, newContent)
        changed ||= contentResult.replaced
        const sources = document.sources ? Object.fromEntries(Object.entries(document.sources).map(([mode, value]) => {
          if (value === undefined) return [mode, value]
          const sourceMode = mode as AuthoringMode
          const result = replaceFirst(value, convertContent(instance.renderedContent, instance.mode, sourceMode), convertContent(nextRendered, instance.mode, sourceMode))
          changed ||= result.replaced
          return [mode, result.value]
        })) as typeof document.sources : undefined
        const oldNexus = normalizeForNexus(instance.renderedContent, instance.mode)
        const newNexus = normalizeForNexus(nextRendered, instance.mode)
        const nexusResult = document.nexusContent ? replaceFirst(document.nexusContent, oldNexus, newNexus) : { value: document.nexusContent, replaced: false }
        changed ||= nexusResult.replaced
        applied ||= changed
        return changed ? { ...document, content: contentResult.value, sources, nexusContent: nexusResult.value, updatedAt: Date.now() } : document
      })
      return applied ? { ...current, documents, componentInstances: current.componentInstances.map((candidate) => candidate.id === id ? { ...candidate, renderedContent: nextRendered, updatedAt: Date.now() } : candidate) } : current
    }, true, true)
    return applied
  },
  detachComponentInstance(id: string) { update((current) => ({ ...current, componentInstances: current.componentInstances.filter((instance) => instance.id !== id) })) },
  addTemplate(block: Omit<ReusableBlock, 'id' | 'createdAt'>) {
    update((current) => ({ ...current, templates: [...current.templates, { ...block, id: crypto.randomUUID(), createdAt: Date.now() }] }))
  },
  deleteTemplate(id: string) { update((current) => ({ ...current, templates: current.templates.filter((block) => block.id !== id) })) },
  importTemplates(blocks: Array<Omit<ReusableBlock, 'id' | 'createdAt'>>) {
    update((current) => ({ ...current, templates: [...current.templates, ...blocks.map((block) => ({ ...block, id: crypto.randomUUID(), createdAt: Date.now() }))] }))
  },
  replaceSnapshot(snapshot: WorkspaceSnapshot) {
    update((current) => ({ ...current, ...parseWorkspaceSnapshot(snapshot, 'This workspace file is not valid or uses an unsupported version.') }))
  },
  async flushPersistence() {
    await hydration
    clearTimeout(saveTimer)
    saveTimer = undefined
    const checkpointPending = checkpointTimer !== undefined
    clearTimeout(checkpointTimer)
    checkpointTimer = undefined
    await persistWorkspace(serializableSnapshot())
    if (checkpointPending && state.preferences.recoveryEnabled) {
      const document = getActiveDocument()
      await saveCheckpoint({ id: crypto.randomUUID(), documentId: document.id, content: document.content, mode: document.mode, createdAt: Date.now() }, state.preferences.checkpointRetention)
    }
  },
  reportCloseFlushFailure() {
    setSaveError('Could not save before closing. Please try again.')
  },
  reportDesktopLifecycleFailure() {
    setSaveError('Desktop close protection could not start. Save before closing.')
  },
  async resetAllData() {
    clearTimeout(saveTimer)
    clearTimeout(checkpointTimer)
    Object.values(state.assetObjectUrls).forEach((url) => URL.revokeObjectURL(url))
    await clearAllData()
    const snapshot = createDefaultSnapshot()
    await saveWorkspace(snapshot)
    state = { ...state, ...snapshot, hydrated: true, saveState: 'saved', saveError: undefined, screen: 'settings', toolsOpen: false, documentsOpen: false, assetObjectUrls: {} }
    emit()
  },
}

export function useWorkspaceStore() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    () => state,
    () => state,
  )
}

export function getWorkspaceSnapshot() {
  return serializableSnapshot()
}
