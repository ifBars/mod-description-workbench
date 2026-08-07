import { Boxes, Download, FileStack, Image, Palette, PanelsTopLeft, Plus, RefreshCw, Save, Trash2, Upload, View, X } from 'lucide-react'
import { useRef, useState } from 'react'
import type { AuthoringMode, AuthoringToolTab } from '../../domain/types'
import type { EditorSelection } from '../editor/editorCommands'
import { convertContent } from '../../markup/convert'
import { imageUsageCount, validateLocalImage } from '../../domain/images'
import { useWorkspaceStore, workspaceActions } from '../../state/workspaceStore'
import { LIBRARY_FILTERS, readLibraryFile, saveLibrary, type LibraryKind } from '../../storage/library'
import { filePlatform } from '../../platform/files'
import { trapFocus } from '../../lib/focusTrap'
import { NEXUS_PUBLIC_FIDELITY_V2 } from '../../fixtures/nexusPublicFidelityV2'
import { SectionBuilderPanel } from './SectionBuilderPanel'
import { ComponentsPanel } from './ComponentsPanel'

interface ToolsDrawerProps {
  open: boolean
  mode: AuthoringMode
  documentContent: string
  documentId: string
  selection: EditorSelection
  initialTab?: AuthoringToolTab
  onClose: () => void
  onInsert: (snippet: string) => void
}

const builtInTemplates: Array<{ name: string; description: string; mode: AuthoringMode; content: string; preserveSource?: boolean }> = [
  { name: 'Clean mod page', description: 'Overview, features, installation, compatibility, and credits.', mode: 'markdown' as const, content: '# Mod name\n\nA short, useful summary.\n\n## Features\n\n- Feature one\n- Feature two\n\n## Installation\n\n1. Install the required loader.\n2. Place the mod in your Mods folder.\n\n## Compatibility\n\nAdd supported versions and known conflicts.\n\n## Credits\n\nThank contributors and dependencies.' },
  { name: 'Changelog block', description: 'A compact release-history section.', mode: 'markdown' as const, content: '## Changelog\n\n### 1.0.0\n\n- Initial release\n- Added core functionality' },
  { name: 'Nexus fidelity fixture v2', description: 'Paste-ready labelled cases for manual Nexus comparison. Use in BBCode mode.', mode: 'bbcode', content: NEXUS_PUBLIC_FIDELITY_V2, preserveSource: true },
]

function imageSnippet(mode: AuthoringMode, source: string, alt: string) {
  if (mode === 'bbcode') return `[img]${source}[/img]`
  return `![${alt}](${source})`
}

export function ToolsDrawer({ open, mode, documentContent, documentId, selection, initialTab = 'images', onClose, onInsert }: ToolsDrawerProps) {
  const state = useWorkspaceStore()
  const [tab, setTab] = useState<AuthoringToolTab>(initialTab)
  const [imageUrl, setImageUrl] = useState('')
  const [imageAlt, setImageAlt] = useState('')
  const [spoilerTitle, setSpoilerTitle] = useState('Installation notes')
  const [spoilerContent, setSpoilerContent] = useState('Hidden details go here.')
  const [color, setColor] = useState('#d97732')
  const [blockName, setBlockName] = useState('My reusable block')
  const [imageNotice, setImageNotice] = useState('')
  const [libraryNotice, setLibraryNotice] = useState('')
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null)
  const [replacementUrl, setReplacementUrl] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [cleanupPending, setCleanupPending] = useState(false)
  const localImageInput = useRef<HTMLInputElement>(null)
  const replacementImageInput = useRef<HTMLInputElement>(null)
  // Image intake remains a WebView file input: it stores browser-owned blobs in IndexedDB and is not a native export flow.
  const unusedImageCount = state.imageAssets.filter((asset) => imageUsageCount(state.documents, asset) === 0).length

  const addRemoteImage = () => {
    if (!/^https:\/\//i.test(imageUrl)) return
    const asset = workspaceActions.addRemoteImage(imageAlt || new URL(imageUrl).pathname.split('/').at(-1) || 'Remote image', imageUrl)
    onInsert(imageSnippet(mode, asset.url!, imageAlt))
  }
  const addLocalImage = async (file?: File) => {
    if (!file) return
    const validation = validateLocalImage(file)
    if (validation) { setImageNotice(validation); return }
    try {
      const asset = await workspaceActions.addLocalImage(file)
      onInsert(imageSnippet(mode, `asset://${asset.id}`, imageAlt || asset.name))
    } catch (error) { setImageNotice(error instanceof Error ? error.message : 'Could not add this image.') }
  }
  const replaceImage = async (file?: File) => {
    if (!file || !replaceTargetId) return
    const validation = validateLocalImage(file)
    if (validation) { setImageNotice(validation); return }
    try {
      await workspaceActions.replaceLocalImage(replaceTargetId, file)
      setImageNotice('Local image replaced everywhere it is used.')
      setReplaceTargetId(null)
    } catch (error) { setImageNotice(error instanceof Error ? error.message : 'Could not replace this image.') }
  }
  const applyRemoteReplacement = () => {
    if (!replaceTargetId || !/^https:\/\//i.test(replacementUrl)) return
    try {
      workspaceActions.replaceRemoteImage(replaceTargetId, replacementUrl)
      setImageNotice('Remote URL replaced everywhere it is used.')
      setReplaceTargetId(null)
      setReplacementUrl('')
    } catch (error) { setImageNotice(error instanceof Error ? error.message : 'Could not replace this URL.') }
  }
  const removeImage = async (id: string) => {
    if (pendingDeleteId !== id) { setPendingDeleteId(id); return }
    await workspaceActions.deleteImage(id)
    setPendingDeleteId(null)
    setImageNotice('Image removed from the library. Existing source references were left intact.')
  }
  const cleanupUnused = async () => {
    if (!cleanupPending) { setCleanupPending(true); return }
    const count = await workspaceActions.deleteUnusedImages()
    setCleanupPending(false)
    setImageNotice(`${count} unused image${count === 1 ? '' : 's'} removed.`)
  }
  const importLibrary = async (kind: LibraryKind) => {
    try {
      const selection = await (await filePlatform()).chooseFile({ filters: LIBRARY_FILTERS })
      if (selection.cancelled) return
      const blocks = await readLibraryFile(selection.file, kind)
      if (kind === 'components') workspaceActions.importComponents(blocks)
      else workspaceActions.importTemplates(blocks)
      setLibraryNotice(`Imported ${blocks.length} ${kind}.`)
    } catch (error) { setLibraryNotice(error instanceof Error ? error.message : `Could not import ${kind}.`) }
  }
  const exportLibrary = async (kind: LibraryKind) => {
    try {
      const result = await saveLibrary(kind, kind === 'components' ? state.components : state.templates)
      if (result.cancelled) return
      setLibraryNotice(`Exported ${kind}.`)
    } catch { setLibraryNotice(`Could not export ${kind}.`) }
  }
  const insertBlock = (snippet: string) => onInsert(`\n\n${snippet}\n\n`)
  const spoilerSource = mode === 'bbcode'
    ? `[spoiler]${spoilerContent}[/spoiler]`
    : `:::spoiler ${spoilerTitle}\n${spoilerContent}\n:::`
  const insertSpoiler = () => insertBlock(spoilerSource)
  const insertColor = () => onInsert(`[color=${color}]${selection.hasSelection ? selection.content : 'coloured text'}[/color]`)
  const insertionTarget = selection.hasSelection ? `replaces the ${selection.content.length}-character editor selection` : 'inserts at the current editor cursor'

  return (
    <aside className={`side-drawer tools-drawer ${open ? 'open' : ''}`} aria-label="Authoring tools" aria-hidden={!open} onKeyDown={(event) => trapFocus(event, onClose)}>
      <header className="drawer-header"><div><span className="eyebrow">Authoring</span><h2>Tools</h2></div><button className="icon-button" autoFocus onClick={onClose} aria-label="Close tools"><X /></button></header>
      <nav className="tool-tabs" aria-label="Tool categories">{([['sections', PanelsTopLeft], ['images', Image], ['spoiler', View], ['components', Boxes], ['templates', FileStack], ['color', Palette]] as const).map(([name, Icon]) => <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}><Icon />{name}</button>)}</nav>
      <div className="tool-body">
        {tab === 'sections' && <><SectionBuilderPanel mode={mode} onInsert={insertBlock} /><p className="tool-outcome">Insert {insertionTarget}. It changes this document only; save it as a Component if you want to reuse it.</p></>}
        {tab === 'images' && <section>
          <h3>Image library</h3>
          <p className="section-copy">Add an image to the local library and insert it into this document. Remote HTTPS images are Nexus-ready; local files preview here but must be replaced with a public URL before export.</p>
          {imageNotice && <p className="inline-notice" role="status">{imageNotice}</p>}
          <label>Image URL<input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://example.com/image.png" /></label>
          <label>Alt text<input value={imageAlt} onChange={(event) => setImageAlt(event.target.value)} placeholder="What the image shows" /></label>
          <div className="button-row">
            <button className="button primary" disabled={!/^https:\/\//i.test(imageUrl)} onClick={addRemoteImage}><Plus />Save URL and insert</button>
            <button className="button secondary" onClick={() => localImageInput.current?.click()}><Upload />Save local file and insert</button>
            <input ref={localImageInput} hidden type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(event) => void addLocalImage(event.target.files?.[0])} />
          </div>
          {state.imageAssets.length > 0 && <div className="asset-library-actions">
            <span>{state.imageAssets.length} image{state.imageAssets.length === 1 ? '' : 's'} · {unusedImageCount} unused</span>
            <button className={cleanupPending ? 'button danger' : 'button quiet'} disabled={unusedImageCount === 0} onClick={() => void cleanupUnused()}>{cleanupPending ? <Trash2 /> : <RefreshCw />}{cleanupPending ? `Confirm remove ${unusedImageCount}` : 'Clean unused'}</button>
          </div>}
          <div className="asset-list">{state.imageAssets.map((asset) => {
            const usage = imageUsageCount(state.documents, asset)
            const dimensions = asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''
            return <div className="asset-entry" key={asset.id}>
              <div className="asset-row">
                {asset.kind === 'local' && state.assetObjectUrls[asset.id] ? <img src={state.assetObjectUrls[asset.id]} alt="" /> : <Image />}
                <button aria-label={`Insert image ${asset.name}`} onClick={() => onInsert(imageSnippet(mode, asset.url ?? `asset://${asset.id}`, asset.name))}><strong>{asset.name}</strong><small>{asset.kind === 'local' ? `${Math.ceil(asset.size / 1024)} KB · local only${dimensions}` : `Remote URL${dimensions}`} · used {usage}× · click to insert</small></button>
                <div className="asset-actions">
                  <button className="icon-button subtle" onClick={() => { setReplaceTargetId(asset.id); setReplacementUrl(asset.url ?? '') }} aria-label={`Replace ${asset.name}`}><RefreshCw /></button>
                  <button className={`icon-button subtle ${pendingDeleteId === asset.id ? 'danger' : ''}`} onClick={() => void removeImage(asset.id)} aria-label={`${pendingDeleteId === asset.id ? 'Confirm delete' : 'Delete'} ${asset.name}`}><Trash2 /></button>
                </div>
              </div>
              {replaceTargetId === asset.id && (asset.kind === 'local'
                ? <div className="asset-replace-row"><span>Choose a new local file; every existing use keeps working.</span><button className="button secondary" onClick={() => replacementImageInput.current?.click()}><Upload />Choose replacement</button></div>
                : <div className="asset-replace-row"><label>Replacement URL<input value={replacementUrl} onChange={(event) => setReplacementUrl(event.target.value)} /></label><div className="button-row"><button className="button primary" disabled={!/^https:\/\//i.test(replacementUrl)} onClick={applyRemoteReplacement}>Replace everywhere</button><button className="button quiet" onClick={() => setReplaceTargetId(null)}>Cancel</button></div></div>)}
            </div>
          })}</div>
          <input ref={replacementImageInput} hidden type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(event) => void replaceImage(event.target.files?.[0])} />
          <p className="tool-outcome">Inserting an image {insertionTarget} and closes Tools. Replacing a library image updates every use of that library entry.</p>
        </section>}
        {tab === 'spoiler' && <section><h3>Spoiler builder</h3><p className="section-copy">Create collapsible content. Nexus always displays its fixed “Spoiler: Show” control.</p>{mode === 'markdown' && <label>Workbench label <span className="field-note">Not exported to Nexus</span><input value={spoilerTitle} onChange={(event) => setSpoilerTitle(event.target.value)} /></label>}<label>Content hidden inside the spoiler<textarea rows={7} value={spoilerContent} onChange={(event) => setSpoilerContent(event.target.value)} /></label><details className="section-source-preview"><summary>Preview source to insert</summary><pre>{spoilerSource}</pre></details><button className="button primary" onClick={insertSpoiler}><Plus />Insert spoiler into document</button><p className="tool-outcome">Insert {insertionTarget} and closes Tools. This does not create a saved reusable item.</p></section>}
        {tab === 'components' && <ComponentsPanel mode={mode} documentContent={documentContent} documentId={documentId} selection={selection} onInsert={onInsert} />}
        {tab === 'templates' && <section>
          <h3>Templates</h3><p className="section-copy">Templates are complete starting structures. Saving a template always captures the entire current document—not selected text.</p>
          {libraryNotice && <p className="inline-notice" role="status">{libraryNotice}</p>}
          <div className="tool-subsection"><h4>Save this document</h4><label>Template name<input value={blockName} onChange={(event) => setBlockName(event.target.value)} /></label><button className="button secondary" disabled={!blockName.trim() || !documentContent.trim()} onClick={() => { workspaceActions.addTemplate({ name: blockName.trim(), mode, content: documentContent }); setLibraryNotice(`Saved the entire ${documentContent.length.toLocaleString()}-character document as ${blockName.trim()}.`) }}><Save />Save entire document as template</button></div>
          <div className="tool-subsection"><h4>Insert a starting structure</h4><p className="section-copy">Choose a template to insert it at the current selection or cursor. Your existing document is not cleared.</p>{builtInTemplates.map((template) => <button className="library-item" key={template.name} disabled={template.preserveSource && mode !== template.mode} title={template.preserveSource && mode !== template.mode ? `Switch to ${template.mode.toUpperCase()} to preserve the canonical source` : undefined} onClick={() => insertBlock(convertContent(template.content, template.mode, mode))}><FileStack /><span><strong>{template.name}</strong><small>{template.description} · click to insert</small></span><Plus /></button>)}{state.templates.map((template) => <div className="library-row" key={template.id}><button className="library-item" aria-label={`Insert template ${template.name}`} onClick={() => insertBlock(convertContent(template.content, template.mode, mode))}><FileStack /><span><strong>{template.name}</strong><small>Saved as {template.mode.toUpperCase()} · click to insert</small></span><Plus /></button><button className="icon-button subtle" aria-label={`Delete template ${template.name}`} onClick={() => workspaceActions.deleteTemplate(template.id)}><Trash2 /></button></div>)}</div>
          <div className="tool-subsection"><h4>Move the template library</h4><div className="button-row compact-row"><button className="button secondary" disabled={state.templates.length === 0} onClick={() => void exportLibrary('templates')}><Download />Export saved templates</button><button className="button secondary" onClick={() => void importLibrary('templates')}><Upload />Import templates</button></div></div>
        </section>}
        {tab === 'color' && <section><h3>Colour text</h3><p className="section-copy">Choose a Nexus-compatible hex colour. {selection.hasSelection ? `The selected text “${selection.content.slice(0, 48)}${selection.content.length > 48 ? '…' : ''}” will be wrapped with a colour tag.` : 'No text was selected, so editable placeholder text will be inserted.'}</p><label>Hex colour<div className="color-control"><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /><input value={color} onChange={(event) => setColor(event.target.value)} /></div></label><div className="color-preview" style={{ color }}>{selection.hasSelection ? selection.content : 'Coloured text preview'}</div><details className="section-source-preview"><summary>Preview source to insert</summary><pre>{`[color=${color}]${selection.hasSelection ? selection.content : 'coloured text'}[/color]`}</pre></details><button className="button primary" onClick={insertColor}><Plus />{selection.hasSelection ? 'Apply colour to selected text' : 'Insert coloured text'}</button><p className="tool-outcome">The action {insertionTarget} and closes Tools.</p></section>}
      </div>
    </aside>
  )
}
