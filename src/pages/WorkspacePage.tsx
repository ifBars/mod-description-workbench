import { Check, Columns2, Download, FileText, PanelLeft, PanelRight, Settings, SlidersHorizontal, Upload, X } from 'lucide-react'
import { lazy, Suspense, useRef, useState } from 'react'
import type { AuthoringMode, AuthoringToolTab } from '../domain/types'
import { themeVariables } from '../domain/themes'
import { DocumentsDrawer } from '../features/documents/DocumentsDrawer'
import { FormattingToolbar } from '../features/editor/FormattingToolbar'
import type { EditorHandle, EditorSelection } from '../features/editor/editorCommands'
import { NexusPreview } from '../features/preview/NexusPreview'
import { SettingsPage } from '../features/settings/SettingsPage'
import { ToolsDrawer } from '../features/tools/ToolsDrawer'
import { SplitDivider } from '../features/layout/SplitDivider'
import { getWorkspaceSnapshot, useWorkspaceStore, workspaceActions } from '../state/workspaceStore'
import { WORKSPACE_IMPORT_FILTERS, readWorkspaceBundle, saveWorkspaceBundle } from '../storage/bundle'
import { exportDocumentContent, saveDocument } from '../storage/documentExport'
import { trapFocus } from '../lib/focusTrap'
import { filePlatform } from '../platform/files'

type VisualEditorModule = { default: typeof import('../features/editor/VisualEditor').VisualEditor }
let visualEditorModule: Promise<VisualEditorModule> | undefined
function loadVisualEditor(): Promise<VisualEditorModule> {
  return visualEditorModule ??= import('../features/editor/VisualEditor').then((module) => ({ default: module.VisualEditor }))
}
const VisualEditor = lazy(loadVisualEditor)
const SourceEditor = lazy(() => import('../features/editor/SourceEditor').then((module) => ({ default: module.SourceEditor })))

export function WorkspacePage() {
  const state = useWorkspaceStore()
  const document = state.documents.find((item) => item.id === state.activeDocumentId) ?? state.documents[0]!
  const [exportOpen, setExportOpen] = useState(false)
  const [exportStatus, setExportStatus] = useState('')
  const [editorSurface, setEditorSurface] = useState<'source' | 'visual'>('source')
  const [visualReady, setVisualReady] = useState(false)
  const [toolSelection, setToolSelection] = useState<EditorSelection>({ content: '', hasSelection: false })
  const sourceEditor = useRef<EditorHandle>(null)
  const visualEditor = useRef<EditorHandle>(null)
  const overlayTrigger = useRef<HTMLElement | null>(null)
  const theme = state.preferences.theme === 'system'
    ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : state.preferences.theme
  const customTheme = state.customThemes.find((candidate) => candidate.id === state.preferences.customThemeId)

  const changeMode = (mode: AuthoringMode) => {
    setEditorSurface('source')
    if (mode === document.mode) return
    workspaceActions.setMode(mode)
  }
  const openVisual = () => { setVisualReady(true); setEditorSurface('visual') }
  const changeEditorSurface = (value: AuthoringMode | 'visual') => value === 'visual' ? openVisual() : changeMode(value)
  const activeEditor = editorSurface === 'visual' ? visualEditor : sourceEditor
  const insert = (snippet: string) => activeEditor.current?.insert(snippet)
  const rememberOverlayTrigger = () => { overlayTrigger.current = globalThis.document.activeElement as HTMLElement | null }
  const restoreOverlayTrigger = () => requestAnimationFrame(() => (overlayTrigger.current ?? globalThis.document.querySelector<HTMLElement>('.utility-rail [title="Tools"], .mobile-bottom-nav button:nth-child(3)'))?.focus())
  const openTools = (tab: AuthoringToolTab = 'images') => {
    rememberOverlayTrigger()
    setToolSelection(activeEditor.current?.getSelection() ?? { content: '', hasSelection: false })
    workspaceActions.openTools(tab)
  }
  const closeTools = () => { workspaceActions.toggleTools(false); restoreOverlayTrigger() }
  const openDocuments = () => { rememberOverlayTrigger(); workspaceActions.toggleDocuments(true) }
  const closeDocuments = () => { workspaceActions.toggleDocuments(false); restoreOverlayTrigger() }
  const closeExport = () => { setExportOpen(false); restoreOverlayTrigger() }
  const toggleExport = () => {
    if (exportOpen) closeExport()
    else { rememberOverlayTrigger(); setExportOpen(true) }
  }
  const openMobilePreview = () => { workspaceActions.setPreviewDevice('mobile'); workspaceActions.setLayout('preview') }
  const toggleMobilePreview = () => state.preferences.layout === 'preview' ? workspaceActions.setLayout('write') : openMobilePreview()
  const importWorkspace = async () => {
    try {
      const selection = await (await filePlatform()).chooseFile({ filters: WORKSPACE_IMPORT_FILTERS })
      if (selection.cancelled) return
      workspaceActions.replaceSnapshot(await readWorkspaceBundle(selection.file))
      closeExport()
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : 'Workspace import failed.')
    }
  }
  const exportDocument = async (format: 'markdown' | 'bbcode' | 'html' | 'text') => {
    try { await saveDocument(document, format) } catch { setExportStatus('Document export failed.') }
  }
  const exportWorkspace = async () => {
    try { await saveWorkspaceBundle(getWorkspaceSnapshot()) } catch { setExportStatus('Workspace export failed.') }
  }
  const copyBBCode = async () => {
    await navigator.clipboard.writeText(exportDocumentContent(document, 'bbcode'))
    setExportStatus('Nexus BBCode copied')
  }

  return (
    <>
    <div className="app-shell" data-theme={theme} data-reduced-motion={state.preferences.reducedMotion} style={themeVariables(customTheme)} hidden={state.screen !== 'workspace'}>
      <header className="app-header">
        <button className="brand" aria-label="Mod Description Workbench"><span className="brand-mark">{'{}'}</span></button>
        <input className="document-title" value={document.title} onChange={(event) => workspaceActions.updateTitle(event.target.value)} aria-label="Document title" />
        <div className="header-actions">
          <div className="layout-controls header-layout-controls mobile-hidden" role="group" aria-label="Workspace layout">
            <button className={state.preferences.layout === 'write' ? 'active icon-button' : 'icon-button'} onClick={() => workspaceActions.setLayout('write')} title="Editor only" aria-label="Editor only"><PanelLeft /></button>
            <button className={state.preferences.layout === 'split' ? 'active icon-button' : 'icon-button'} onClick={() => workspaceActions.setLayout('split')} title="Split view" aria-label="Split view"><Columns2 /></button>
            <button className={state.preferences.layout === 'preview' ? 'active icon-button' : 'icon-button'} onClick={() => workspaceActions.setLayout('preview')} title="Preview only" aria-label="Preview only"><PanelRight /></button>
          </div>
          <div className="export-control">
            <button className="button primary" aria-expanded={exportOpen} aria-haspopup="dialog" onClick={toggleExport}><Download />Export</button>
            {exportOpen && <div className="export-menu" role="dialog" aria-label="Export and import" onKeyDown={(event) => trapFocus(event, closeExport)}>
              <div className="export-menu-header"><strong>Current document</strong><button className="icon-button subtle" aria-label="Close export" onClick={closeExport}><X /></button></div>
              <button autoFocus onClick={() => void exportDocument('markdown')}>Download Markdown</button>
              <button onClick={() => void exportDocument('bbcode')}>Download Nexus BBCode</button>
              <button onClick={() => void exportDocument('html')}>Download rich HTML</button>
              <button onClick={() => void exportDocument('text')}>Download plain text</button>
              <button onClick={() => void copyBBCode()}>Copy Nexus BBCode</button>
              <span />
              <strong>Portable workspace</strong>
              <button onClick={() => void exportWorkspace()}>Download workspace (.mdw)</button>
              <button onClick={() => void importWorkspace()}><Upload />Import workspace</button>
              {exportStatus && <small role="status">{exportStatus}</small>}
            </div>}
          </div>
          <button className="icon-button mobile-menu" aria-label="Settings" onClick={() => workspaceActions.setScreen('settings')}><Settings /></button>
        </div>
      </header>

      <div className="mobile-modebar">
        <div className="segmented"><button className={state.preferences.layout !== 'preview' ? 'active' : ''} onClick={() => workspaceActions.setLayout('write')}>Write</button><button className={state.preferences.layout === 'preview' ? 'active' : ''} onClick={openMobilePreview}>Preview</button></div>
        {state.preferences.layout !== 'preview' && <label className="mobile-mode-select"><span>Editor view</span><select value={editorSurface === 'visual' ? 'visual' : document.mode} onFocus={() => void loadVisualEditor()} onChange={(event) => changeEditorSurface(event.target.value as AuthoringMode | 'visual')}><option value="markdown">Markdown</option><option value="bbcode">BBCode</option><option value="visual">Visual</option></select></label>}
      </div>

      <div className="workspace-frame">
        <aside className="utility-rail mobile-hidden" aria-label="Workspace navigation">
          <button className="rail-button active" onClick={openDocuments} title="Documents"><FileText /><span>Documents</span></button>
          <span className="rail-spacer" />
          <button className="rail-button" onClick={() => openTools()} title="Tools"><SlidersHorizontal /><span>Tools</span></button>
          <button className="rail-button" onClick={() => workspaceActions.setScreen('settings')} title="Settings"><Settings /><span>Settings</span></button>
        </aside>

        <main className={`workspace layout-${state.preferences.layout} ${state.toolsOpen ? 'tools-visible' : ''}`} style={state.preferences.layout === 'split' ? { gridTemplateColumns: `minmax(420px, ${state.preferences.splitRatio}fr) 5px minmax(380px, ${100 - state.preferences.splitRatio}fr)` } : undefined}>
          <section className="editor-pane" aria-label="Editor">
            <header className="pane-header editor-header">
              <nav className="mode-tabs" aria-label="Editor view">
                <button className={editorSurface === 'source' && document.mode === 'markdown' ? 'active' : ''} onClick={() => changeMode('markdown')}>Markdown</button>
                <button className={editorSurface === 'source' && document.mode === 'bbcode' ? 'active' : ''} onClick={() => changeMode('bbcode')}>BBCode</button>
                <button className={editorSurface === 'visual' ? 'active' : ''} onPointerEnter={() => void loadVisualEditor()} onFocus={() => void loadVisualEditor()} onClick={openVisual}>Visual</button>
              </nav>
            </header>
            <FormattingToolbar mode={document.mode} visual={editorSurface === 'visual'} onCommand={(command) => activeEditor.current?.run(command)} onModeChange={changeMode} onOpenTools={openTools} />
            <div className="editor-body">
              <div className="editor-surface-slot" hidden={editorSurface === 'visual'}>
                <Suspense fallback={<div className="screen-loading">Loading source editor…</div>}><SourceEditor ref={sourceEditor} key={document.id} content={document.content} mode={document.mode} fontSize={state.preferences.editorFontSize} wordWrap={state.preferences.wordWrap} onChange={workspaceActions.updateContent} /></Suspense>
              </div>
              {visualReady && <div className="editor-surface-slot" hidden={editorSurface !== 'visual'}>
                <Suspense fallback={<div className="screen-loading">Loading visual editor…</div>}><VisualEditor ref={visualEditor} key={`${document.id}-visual`} bbcode={document.nexusContent ?? exportDocumentContent(document, 'bbcode')} assetUrls={state.assetObjectUrls} onChange={workspaceActions.updateVisualContent} /></Suspense>
              </div>}
            </div>
          </section>
          <SplitDivider ratio={state.preferences.splitRatio} onChange={(splitRatio) => workspaceActions.updatePreferences({ splitRatio })} />
          <NexusPreview content={document.content} mode={document.mode} nexusContent={document.nexusContent} device={state.preferences.previewDevice} zoom={state.preferences.previewZoom} fluidDesktop={state.preferences.layout === 'split'} assetUrls={state.assetObjectUrls} onDeviceChange={workspaceActions.setPreviewDevice} />
        </main>
      </div>

      <footer className="status-bar"><span>{document.content.length.toLocaleString()} characters</span><span>{document.content.trim() ? document.content.trim().split(/\s+/).length.toLocaleString() : 0} words</span><span className="status-spacer" /><span className={`save-status ${state.saveState}`} role={state.saveState === 'error' ? 'alert' : undefined}><Check />{state.saveState === 'saved' ? 'Saved locally' : state.saveState === 'saving' ? 'Saving…' : state.saveError ?? 'Save failed'}</span></footer>
      <nav className="mobile-bottom-nav"><button onClick={openDocuments}><FileText />Documents</button><button onClick={toggleMobilePreview}><PanelRight />{state.preferences.layout === 'preview' ? 'Write' : 'Preview'}</button><button onClick={() => openTools()}><SlidersHorizontal />Tools</button><button onClick={toggleExport}><Download />Export</button></nav>

      {(state.documentsOpen || state.toolsOpen) && <button className="drawer-backdrop" aria-label="Close panel" onClick={() => { if (state.documentsOpen) closeDocuments(); if (state.toolsOpen) closeTools() }} />}
      {state.documentsOpen && <DocumentsDrawer documents={state.documents} activeId={state.activeDocumentId} open onClose={closeDocuments} onCreate={workspaceActions.createDocument} onSelect={(id) => { workspaceActions.selectDocument(id); closeDocuments() }} onDelete={workspaceActions.deleteDocument} onRestore={(documentId, checkpoint) => { workspaceActions.selectDocument(documentId); workspaceActions.restoreContent(checkpoint.content, checkpoint.mode); closeDocuments() }} />}
      {state.toolsOpen && <ToolsDrawer key={state.toolTab} open mode={editorSurface === 'visual' ? 'bbcode' : document.mode} documentContent={editorSurface === 'visual' ? (document.nexusContent ?? exportDocumentContent(document, 'bbcode')) : document.content} documentId={document.id} selection={toolSelection} initialTab={state.toolTab} onClose={closeTools} onInsert={(snippet) => { insert(snippet); closeTools() }} />}
    </div>
    {state.screen === 'settings' && <div className="settings-host" data-theme={theme} style={themeVariables(customTheme)}><SettingsPage /></div>}
    </>
  )
}
