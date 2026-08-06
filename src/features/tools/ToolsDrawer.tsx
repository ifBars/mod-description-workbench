import { Boxes, Download, FileStack, Image, Link2, Palette, Plus, RefreshCw, Save, Trash2, Unlink, Upload, View, X } from 'lucide-react'
import { useRef, useState } from 'react'
import type { AuthoringMode, AuthoringToolTab, ComponentDefinition, ComponentVariable, ComponentVariableType } from '../../domain/types'
import { convertContent } from '../../markup/convert'
import { imageUsageCount, validateLocalImage } from '../../domain/images'
import { useWorkspaceStore, workspaceActions } from '../../state/workspaceStore'
import { downloadLibrary, readLibraryFile, type LibraryKind } from '../../storage/library'
import { componentUpdate, defaultComponentValues, renderComponent } from '../../domain/components'
import { trapFocus } from '../../lib/focusTrap'
import { NEXUS_PUBLIC_FIDELITY_V2 } from '../../fixtures/nexusPublicFidelityV2'

interface ToolsDrawerProps {
  open: boolean
  mode: AuthoringMode
  documentContent: string
  documentId: string
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

function ComponentValueField({ variable, value, onChange }: { variable: ComponentVariable; value: string | boolean; onChange: (value: string | boolean) => void }) {
  if (variable.type === 'boolean') return <label className="switch-row"><span><strong>{variable.name}</strong><small>Include the matching boolean section</small></span><input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} /></label>
  if (variable.type === 'choice') return <label>{variable.name}<select value={String(value)} onChange={(event) => onChange(event.target.value)}>{(variable.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
  if (variable.type === 'color') return <label>{variable.name}<span className="token-input"><input type="color" value={String(value)} onChange={(event) => onChange(event.target.value)} /><input value={String(value)} onChange={(event) => onChange(event.target.value)} /></span></label>
  return <label>{variable.name}<input type={variable.type === 'url' || variable.type === 'image' ? 'url' : 'text'} value={String(value)} onChange={(event) => onChange(event.target.value)} /></label>
}

export function ToolsDrawer({ open, mode, documentContent, documentId, initialTab = 'images', onClose, onInsert }: ToolsDrawerProps) {
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
  const [componentVariables, setComponentVariables] = useState<ComponentVariable[]>([])
  const [variableName, setVariableName] = useState('version')
  const [variableType, setVariableType] = useState<ComponentVariableType>('text')
  const [variableDefault, setVariableDefault] = useState('1.0.0')
  const [variableOptions, setVariableOptions] = useState('Stable, Beta')
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null)
  const [componentValues, setComponentValues] = useState<Record<string, string | boolean>>({})
  const localImageInput = useRef<HTMLInputElement>(null)
  const replacementImageInput = useRef<HTMLInputElement>(null)
  const componentInput = useRef<HTMLInputElement>(null)
  const templateInput = useRef<HTMLInputElement>(null)
  const unusedImageCount = state.imageAssets.filter((asset) => imageUsageCount(state.documents, asset) === 0).length
  const selectedComponent = state.components.find((component) => component.id === selectedComponentId)
  const documentInstances = state.componentInstances.filter((instance) => instance.documentId === documentId)

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
  const importLibrary = async (kind: LibraryKind, file?: File) => {
    if (!file) return
    try {
      const blocks = await readLibraryFile(file, kind)
      if (kind === 'components') workspaceActions.importComponents(blocks)
      else workspaceActions.importTemplates(blocks)
      setLibraryNotice(`Imported ${blocks.length} ${kind}.`)
    } catch (error) { setLibraryNotice(error instanceof Error ? error.message : `Could not import ${kind}.`) }
  }
  const addVariable = () => {
    const name = variableName.trim().replace(/\s+/g, '_')
    if (!/^[a-zA-Z_][\w-]*$/.test(name) || componentVariables.some((variable) => variable.name === name)) {
      setLibraryNotice('Variable names must be unique and use letters, numbers, underscores, or hyphens.')
      return
    }
    const options = variableType === 'choice' ? variableOptions.split(',').map((option) => option.trim()).filter(Boolean) : undefined
    const defaultValue = variableType === 'boolean' ? variableDefault === 'true' : variableType === 'choice' ? options?.[0] ?? '' : variableDefault
    setComponentVariables((variables) => [...variables, { id: crypto.randomUUID(), name, type: variableType, defaultValue, ...(options ? { options } : {}) }])
    setLibraryNotice(`Added {{${name}}}. Place that token in the source before saving.`)
  }
  const saveComponent = () => {
    workspaceActions.addComponent({ name: blockName, mode, content: documentContent, variables: componentVariables })
    setComponentVariables([])
    setLibraryNotice('Component definition saved.')
  }
  const insertLinkedComponent = (definition: ComponentDefinition, values: Record<string, string | boolean>) => {
    const renderedContent = renderComponent(definition, values, mode)
    insertBlock(renderedContent)
    workspaceActions.linkComponentInstance({ definitionId: definition.id, documentId, values, mode, renderedContent })
  }
  const chooseComponent = (definition: ComponentDefinition) => {
    const values = defaultComponentValues(definition)
    if ((definition.variables?.length ?? 0) === 0) { insertLinkedComponent(definition, values); return }
    setSelectedComponentId(definition.id)
    setComponentValues(values)
  }
  const insertBlock = (snippet: string) => onInsert(`\n\n${snippet}\n\n`)
  const insertSpoiler = () => insertBlock(mode === 'bbcode'
    ? `[spoiler]${spoilerContent}[/spoiler]`
    : `:::spoiler ${spoilerTitle}\n${spoilerContent}\n:::`)
  const insertColor = () => onInsert(`[color=${color}]coloured text[/color]`)

  return (
    <aside className={`side-drawer tools-drawer ${open ? 'open' : ''}`} aria-label="Authoring tools" aria-hidden={!open} onKeyDown={(event) => trapFocus(event, onClose)}>
      <header className="drawer-header"><div><span className="eyebrow">Authoring</span><h2>Tools</h2></div><button className="icon-button" autoFocus onClick={onClose} aria-label="Close tools"><X /></button></header>
      <nav className="tool-tabs" aria-label="Tool categories">{([['images', Image], ['spoiler', View], ['components', Boxes], ['templates', FileStack], ['color', Palette]] as const).map(([name, Icon]) => <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}><Icon />{name}</button>)}</nav>
      <div className="tool-body">
        {tab === 'images' && <section>
          <h3>Image library</h3>
          <p className="section-copy">Remote images export directly. Local images stay private and previewable until you replace them with a public Nexus-compatible URL.</p>
          {imageNotice && <p className="inline-notice" role="status">{imageNotice}</p>}
          <label>Image URL<input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://example.com/image.png" /></label>
          <label>Alt text<input value={imageAlt} onChange={(event) => setImageAlt(event.target.value)} placeholder="What the image shows" /></label>
          <div className="button-row">
            <button className="button primary" disabled={!/^https:\/\//i.test(imageUrl)} onClick={addRemoteImage}><Plus />Add URL</button>
            <button className="button secondary" onClick={() => localImageInput.current?.click()}><Upload />Add local</button>
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
                <button onClick={() => onInsert(imageSnippet(mode, asset.url ?? `asset://${asset.id}`, asset.name))}><strong>{asset.name}</strong><small>{asset.kind === 'local' ? `${Math.ceil(asset.size / 1024)} KB · local only${dimensions}` : `Remote URL${dimensions}`} · used {usage}×</small></button>
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
        </section>}
        {tab === 'spoiler' && <section><h3>Spoiler builder</h3><label>Editor label<input value={spoilerTitle} onChange={(event) => setSpoilerTitle(event.target.value)} /></label><label>Hidden content<textarea rows={7} value={spoilerContent} onChange={(event) => setSpoilerContent(event.target.value)} /></label><button className="button primary" onClick={insertSpoiler}><Plus />Insert spoiler</button><p className="section-copy">Nexus exports `[spoiler]...[/spoiler]`; a custom label is project-only because the captured Nexus renderer uses a fixed label.</p></section>}
        {tab === 'components' && <section>
          <h3>Reusable components</h3><p className="section-copy">Save source with typed <code>{'{{variables}}'}</code>, insert linked instances, and review definition updates before applying them.</p>
          {libraryNotice && <p className="inline-notice" role="status">{libraryNotice}</p>}
          <div className="button-row"><button className="button secondary" disabled={state.components.length === 0} onClick={() => downloadLibrary('components', state.components)}><Download />Export library</button><button className="button secondary" onClick={() => componentInput.current?.click()}><Upload />Import library</button><input ref={componentInput} hidden type="file" accept="application/json,.json" onChange={(event) => void importLibrary('components', event.target.files?.[0])} /></div>
          <label>Component name<input value={blockName} onChange={(event) => setBlockName(event.target.value)} /></label>
          <div className="component-variable-builder">
            <div className="section-title-row"><div><h4>Variables</h4><p className="section-copy">Add a variable, then use its token in the source.</p></div><span>{componentVariables.length}</span></div>
            <label>Variable name<input value={variableName} onChange={(event) => setVariableName(event.target.value)} /></label>
            <label>Type<select value={variableType} onChange={(event) => setVariableType(event.target.value as ComponentVariableType)}><option value="text">Text</option><option value="color">Colour</option><option value="url">URL</option><option value="image">Image</option><option value="choice">Choice</option><option value="boolean">Boolean</option></select></label>
            {variableType === 'choice' && <label>Choices<input value={variableOptions} onChange={(event) => setVariableOptions(event.target.value)} placeholder="Stable, Beta" /></label>}
            {variableType === 'boolean' ? <label>Default<select value={variableDefault} onChange={(event) => setVariableDefault(event.target.value)}><option value="true">Enabled</option><option value="false">Disabled</option></select></label> : <label>Default value<input value={variableDefault} onChange={(event) => setVariableDefault(event.target.value)} /></label>}
            <button className="button quiet" onClick={addVariable}><Plus />Add variable</button>
            {componentVariables.map((variable) => <div className="variable-chip" key={variable.id}><code>{`{{${variable.name}}}`}</code><span>{variable.type}</span><button className="icon-button subtle" aria-label={`Remove variable ${variable.name}`} onClick={() => setComponentVariables((variables) => variables.filter((candidate) => candidate.id !== variable.id))}><X /></button></div>)}
          </div>
          <button className="button secondary" onClick={saveComponent}><Save />Save current source</button>
          <button className="library-item" onClick={() => insertBlock(mode === 'bbcode' ? '[quote][b]Compatibility[/b]\nWorks with the current supported game version.[/quote]' : '> **Compatibility**\n> Works with the current supported game version.')}><Boxes /><span><strong>Compatibility callout</strong><small>Quote-based and Nexus-safe</small></span><Plus /></button>
          {state.components.map((block) => <div className="library-row component-library-row" key={block.id}><button className="library-item" onClick={() => chooseComponent(block)}><Boxes /><span><strong>{block.name}</strong><small>{block.variables?.length ?? 0} variables · saved as {block.mode}</small></span>{(block.variables?.length ?? 0) > 0 ? <Link2 /> : <Plus />}</button><button className="icon-button subtle" aria-label={`Edit component ${block.name}`} onClick={() => { setSelectedComponentId(block.id); setComponentValues(defaultComponentValues(block)) }}><RefreshCw /></button><button className="icon-button subtle" aria-label={`Delete component ${block.name}`} onClick={() => workspaceActions.deleteComponent(block.id)}><Trash2 /></button></div>)}
          {selectedComponent && <div className="component-config"><div className="section-title-row"><div><h4>Configure {selectedComponent.name}</h4><p className="section-copy">This inserts materialized Nexus-safe source while retaining a local link.</p></div><button className="icon-button" aria-label="Close component configuration" onClick={() => setSelectedComponentId(null)}><X /></button></div><label>Definition source<textarea rows={5} value={selectedComponent.content} onChange={(event) => workspaceActions.updateComponent(selectedComponent.id, { content: event.target.value })} /></label>{(selectedComponent.variables ?? []).map((variable) => <ComponentValueField key={variable.id} variable={variable} value={componentValues[variable.name] ?? variable.defaultValue} onChange={(value) => setComponentValues((values) => ({ ...values, [variable.name]: value }))} />)}<button className="button primary" onClick={() => insertLinkedComponent(selectedComponent, componentValues)}><Link2 />Insert linked instance</button></div>}
          {documentInstances.length > 0 && <div className="component-instances"><h4>Linked instances in this document</h4>{documentInstances.map((instance) => {
            const definition = state.components.find((candidate) => candidate.id === instance.definitionId)
            if (!definition) return null
            const next = componentUpdate(definition, instance)
            const outdated = next !== instance.renderedContent
            return <div className="component-instance" key={instance.id}><div><strong>{definition.name}</strong><small>{outdated ? 'Update available' : 'Up to date'} · {instance.mode}</small></div>{outdated && <details><summary>Review changes</summary><span>Before</span><pre>{instance.renderedContent}</pre><span>After</span><pre>{next}</pre></details>}<div className="button-row">{outdated && <button className="button secondary" onClick={() => setLibraryNotice(workspaceActions.applyComponentUpdate(instance.id) ? 'Linked instance updated.' : 'The materialized source changed and could not be located; detach or reinsert it.')}><RefreshCw />Apply update</button>}<button className="button quiet" onClick={() => workspaceActions.detachComponentInstance(instance.id)}><Unlink />Detach</button></div></div>
          })}</div>}
        </section>}
        {tab === 'templates' && <section>
          <h3>Templates</h3><p className="section-copy">Insert a practical structure, save this document, or move your template library between browsers.</p>
          {libraryNotice && <p className="inline-notice" role="status">{libraryNotice}</p>}
          <div className="button-row"><button className="button secondary" disabled={state.templates.length === 0} onClick={() => downloadLibrary('templates', state.templates)}><Download />Export library</button><button className="button secondary" onClick={() => templateInput.current?.click()}><Upload />Import library</button><input ref={templateInput} hidden type="file" accept="application/json,.json" onChange={(event) => void importLibrary('templates', event.target.files?.[0])} /></div>
          <label>Template name<input value={blockName} onChange={(event) => setBlockName(event.target.value)} /></label><button className="button secondary" onClick={() => workspaceActions.addTemplate({ name: blockName, mode, content: documentContent })}><Save />Save current document</button>
          {builtInTemplates.map((template) => <button className="library-item" key={template.name} disabled={template.preserveSource && mode !== template.mode} title={template.preserveSource && mode !== template.mode ? `Switch to ${template.mode.toUpperCase()} to preserve the canonical source` : undefined} onClick={() => insertBlock(convertContent(template.content, template.mode, mode))}><FileStack /><span><strong>{template.name}</strong><small>{template.description}</small></span><Plus /></button>)}
          {state.templates.map((template) => <div className="library-row" key={template.id}><button className="library-item" onClick={() => insertBlock(convertContent(template.content, template.mode, mode))}><FileStack /><span><strong>{template.name}</strong><small>Saved as {template.mode}</small></span><Plus /></button><button className="icon-button subtle" aria-label={`Delete template ${template.name}`} onClick={() => workspaceActions.deleteTemplate(template.id)}><Trash2 /></button></div>)}
        </section>}
        {tab === 'color' && <section><h3>Colour picker</h3><p className="section-copy">Nexus accepts hex colours through the `[color]` tag.</p><label>Colour<div className="color-control"><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /><input value={color} onChange={(event) => setColor(event.target.value)} /></div></label><div className="color-preview" style={{ color }}>Colour preview</div><button className="button primary" onClick={insertColor}><Plus />Insert colour</button></section>}
      </div>
    </aside>
  )
}
