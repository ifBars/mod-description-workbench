import { Boxes, Download, Link2, Pencil, Plus, RefreshCw, Save, Trash2, Unlink, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { componentUpdate, componentVariableIssues, defaultComponentValues, renderComponent } from '../../domain/components'
import type { AuthoringMode, ComponentDefinition, ComponentVariable, ComponentVariableType } from '../../domain/types'
import type { EditorSelection } from '../editor/editorCommands'
import { renderBBCode } from '../../markup/bbcode'
import { normalizeForNexus } from '../../markup/convert'
import { useWorkspaceStore, workspaceActions } from '../../state/workspaceStore'
import { downloadLibrary, readLibraryFile } from '../../storage/library'

interface ComponentsPanelProps {
  mode: AuthoringMode
  documentContent: string
  documentId: string
  selection: EditorSelection
  onInsert: (snippet: string) => void
}

function ComponentValueField({ variable, value, onChange }: { variable: ComponentVariable; value: string | boolean; onChange: (value: string | boolean) => void }) {
  const label = variable.name.replace(/[_-]+/g, ' ')
  if (variable.type === 'boolean') return <label className="switch-row"><span><strong>{label}</strong><small>Include the optional section wrapped with this variable.</small></span><input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} /></label>
  if (variable.type === 'choice') return <label>{label}<select value={String(value)} onChange={(event) => onChange(event.target.value)}>{(variable.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
  if (variable.type === 'color') return <label>{label}<span className="token-input"><input type="color" value={String(value)} onChange={(event) => onChange(event.target.value)} /><input value={String(value)} onChange={(event) => onChange(event.target.value)} /></span></label>
  return <label>{label}<input type={variable.type === 'url' || variable.type === 'image' ? 'url' : 'text'} value={String(value)} onChange={(event) => onChange(event.target.value)} /></label>
}

function ComponentPreview({ definition, values, assetUrls }: { definition: ComponentDefinition; values: Record<string, string | boolean>; assetUrls: Record<string, string> }) {
  const rendered = renderComponent(definition, values, definition.mode)
  return <div className="component-preview">
    <div className="component-preview-label"><strong>Preview</strong><span>Using the values shown below</span></div>
    <div className="component-preview-surface"><div className="nexus-description">{renderBBCode(normalizeForNexus(rendered, definition.mode), assetUrls)}</div></div>
    <details><summary>Rendered source</summary><pre>{rendered}</pre></details>
  </div>
}

function variableToken(variable: ComponentVariable) {
  return variable.type === 'boolean'
    ? `{{#${variable.name}}}optional content{{/${variable.name}}}`
    : `{{${variable.name}}}`
}

export function ComponentsPanel({ mode, documentContent, documentId, selection, onInsert }: ComponentsPanelProps) {
  const state = useWorkspaceStore()
  const [view, setView] = useState<'create' | 'saved'>('create')
  const [draftName, setDraftName] = useState('My reusable block')
  const [draftSource, setDraftSource] = useState(() => selection.hasSelection ? selection.content : '')
  const [draftVariables, setDraftVariables] = useState<ComponentVariable[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [variableName, setVariableName] = useState('version')
  const [variableType, setVariableType] = useState<ComponentVariableType>('text')
  const [variableDefault, setVariableDefault] = useState('1.0.0')
  const [variableOptions, setVariableOptions] = useState('Stable, Beta')
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null)
  const [componentValues, setComponentValues] = useState<Record<string, string | boolean>>({})
  const [notice, setNotice] = useState('')
  const sourceInput = useRef<HTMLTextAreaElement>(null)
  const componentInput = useRef<HTMLInputElement>(null)
  const selectedComponent = state.components.find((component) => component.id === selectedComponentId)
  const documentInstances = state.componentInstances.filter((instance) => instance.documentId === documentId)
  const draftDefinition: ComponentDefinition = { id: editingId ?? 'component-draft', name: draftName, mode, content: draftSource, variables: draftVariables, createdAt: 0 }
  const draftValues = defaultComponentValues(draftDefinition)
  const draftIssues = componentVariableIssues(draftSource, draftVariables)

  const resetDraft = (source = '') => {
    setDraftName('My reusable block')
    setDraftSource(source)
    setDraftVariables([])
    setEditingId(null)
    setNotice('')
    setView('create')
  }
  const insertAtCaret = (token: string) => {
    const input = sourceInput.current
    const hasActiveCaret = input != null && document.activeElement === input
    const from = hasActiveCaret ? input.selectionStart : draftSource.length
    const to = hasActiveCaret ? input.selectionEnd : from
    setDraftSource((current) => current.slice(0, from) + token + current.slice(to))
    requestAnimationFrame(() => {
      sourceInput.current?.focus()
      sourceInput.current?.setSelectionRange(from, from + token.length)
    })
  }
  const addVariable = () => {
    const name = variableName.trim().replace(/\s+/g, '_')
    if (!/^[a-zA-Z_][\w-]*$/.test(name) || draftVariables.some((variable) => variable.name === name)) {
      setNotice('Variable names must be unique and use letters, numbers, underscores, or hyphens.')
      return
    }
    const options = variableType === 'choice' ? variableOptions.split(',').map((option) => option.trim()).filter(Boolean) : undefined
    const defaultValue = variableType === 'boolean' ? variableDefault === 'true' : variableType === 'choice' ? options?.[0] ?? '' : variableDefault
    const variable: ComponentVariable = { id: crypto.randomUUID(), name, type: variableType, defaultValue, ...(options ? { options } : {}) }
    setDraftVariables((variables) => [...variables, variable])
    insertAtCaret(variableToken(variable))
    setNotice(`Added and inserted ${variable.type === 'boolean' ? `an optional ${name} section` : `{{${name}}}`}.`)
  }
  const saveDraft = () => {
    if (!draftName.trim() || !draftSource.trim() || draftIssues.length > 0) return
    if (editingId) {
      workspaceActions.updateComponent(editingId, { name: draftName.trim(), mode, content: draftSource, variables: draftVariables })
      setSelectedComponentId(editingId)
      setComponentValues(defaultComponentValues({ ...draftDefinition, id: editingId }))
      setNotice('Component changes saved. Existing instances can be reviewed below.')
    } else {
      workspaceActions.addComponent({ name: draftName.trim(), mode, content: draftSource, variables: draftVariables })
      setNotice('Component saved. Open it below to configure and insert it.')
    }
    setView('saved')
    setEditingId(null)
  }
  const editDefinition = (definition: ComponentDefinition) => {
    setDraftName(definition.name)
    setDraftSource(definition.content)
    setDraftVariables([...(definition.variables ?? [])])
    setEditingId(definition.id)
    setNotice(`Editing ${definition.name}. Changes are not saved until you press Save changes.`)
    setView('create')
  }
  const chooseComponent = (definition: ComponentDefinition) => {
    setSelectedComponentId(definition.id)
    setComponentValues(defaultComponentValues(definition))
    setNotice('Review the preview, adjust any values, then insert.')
  }
  const insertComponent = (definition: ComponentDefinition) => {
    const renderedContent = renderComponent(definition, componentValues, mode)
    onInsert(`\n\n${renderedContent}\n\n`)
    workspaceActions.linkComponentInstance({ definitionId: definition.id, documentId, values: componentValues, mode, renderedContent })
  }
  const importComponents = async (file?: File) => {
    if (!file) return
    try {
      const blocks = await readLibraryFile(file, 'components')
      workspaceActions.importComponents(blocks)
      setNotice(`Imported ${blocks.length} component${blocks.length === 1 ? '' : 's'}.`)
      setView('saved')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not import components.') }
  }

  return <section className="components-panel">
    <div>
      <h3>Components</h3>
      <p className="section-copy">Reusable pieces of a description—such as a release banner or requirements block. Save once, preview each variation, then insert it wherever needed.</p>
    </div>
    <div className="component-view-tabs" role="tablist" aria-label="Component workflow">
      <button className={view === 'create' ? 'active' : ''} role="tab" aria-selected={view === 'create'} onClick={() => setView('create')}>{editingId ? 'Edit component' : 'Create'}</button>
      <button className={view === 'saved' ? 'active' : ''} role="tab" aria-selected={view === 'saved'} onClick={() => setView('saved')}>Saved <span>{state.components.length}</span></button>
    </div>
    {notice && <p className="inline-notice" role="status">{notice}</p>}

    {view === 'create' && <>
      <div className="component-step">
        <div className="component-step-heading"><span>1</span><div><h4>Choose the reusable content</h4><p>{selection.hasSelection ? `${selection.content.length} characters were captured from your editor selection.` : 'Nothing was selected when Tools opened. Start blank or use the whole document.'}</p></div></div>
        <div className="button-row compact-row">
          <button className="button secondary" disabled={!selection.hasSelection} onClick={() => setDraftSource(selection.content)}>Use selected text</button>
          <button className="button quiet" onClick={() => setDraftSource(documentContent)}>Use entire document</button>
        </div>
        <label>Component name<input value={draftName} onChange={(event) => setDraftName(event.target.value)} /></label>
        <label>Component source<textarea ref={sourceInput} rows={8} value={draftSource} placeholder="Select text before opening Tools, paste source here, or use the whole document." onChange={(event) => setDraftSource(event.target.value)} /></label>
      </div>

      <details className="component-step component-variable-guide">
        <summary><span className="component-step-number">2</span><span><strong>Add variables <em>optional</em></strong><small>Values you can change each time before inserting.</small></span></summary>
        <div className="variable-explainer"><code>{'{{version}}'}</code><span>becomes a value such as <strong>1.2.0</strong>. A boolean wraps content that can be turned on or off.</span></div>
        <div className="component-variable-fields">
          <label>Variable name<input value={variableName} onChange={(event) => setVariableName(event.target.value)} /></label>
          <label>Value type<select value={variableType} onChange={(event) => setVariableType(event.target.value as ComponentVariableType)}><option value="text">Text</option><option value="color">Colour</option><option value="url">URL</option><option value="image">Image URL</option><option value="choice">Choice</option><option value="boolean">On / off section</option></select></label>
          {variableType === 'choice' && <label>Choices<input value={variableOptions} onChange={(event) => setVariableOptions(event.target.value)} placeholder="Stable, Beta" /></label>}
          {variableType === 'boolean' ? <label>Default<select value={variableDefault} onChange={(event) => setVariableDefault(event.target.value)}><option value="true">Included</option><option value="false">Hidden</option></select></label> : <label>Default value<input value={variableDefault} onChange={(event) => setVariableDefault(event.target.value)} /></label>}
          <button className="button secondary" onClick={addVariable}><Plus />Add and insert variable</button>
        </div>
        {draftVariables.map((variable) => <div className="variable-chip" key={variable.id}><button className="variable-token" onClick={() => insertAtCaret(variableToken(variable))}><code>{variable.type === 'boolean' ? `{{#${variable.name}}}…{{/${variable.name}}}` : `{{${variable.name}}}`}</code><small>Insert again</small></button><span>{variable.type}</span><button className="icon-button subtle" aria-label={`Remove variable ${variable.name}`} onClick={() => setDraftVariables((variables) => variables.filter((candidate) => candidate.id !== variable.id))}><X /></button></div>)}
      </details>

      <div className="component-step">
        <div className="component-step-heading"><span>3</span><div><h4>Preview and save</h4><p>This is what the component looks like with its default values.</p></div></div>
        {draftSource.trim() ? <ComponentPreview definition={draftDefinition} values={draftValues} assetUrls={state.assetObjectUrls} /> : <div className="component-empty-preview">Add component source to see a preview.</div>}
        {draftIssues.length > 0 && <div className="component-issues" role="alert">{draftIssues.map((issue) => <span key={issue}>{issue}</span>)}</div>}
        <div className="button-row compact-row">
          <button className="button primary" disabled={!draftName.trim() || !draftSource.trim() || draftIssues.length > 0} onClick={saveDraft}><Save />{editingId ? 'Save changes' : 'Save component'}</button>
          {editingId && <button className="button quiet" onClick={() => { resetDraft(selection.hasSelection ? selection.content : ''); setView('saved') }}>Cancel</button>}
        </div>
      </div>
    </>}

    {view === 'saved' && <>
      <div className="component-library-actions"><button className="button secondary" disabled={state.components.length === 0} onClick={() => downloadLibrary('components', state.components)}><Download />Export</button><button className="button secondary" onClick={() => componentInput.current?.click()}><Upload />Import</button><button className="button quiet" onClick={() => resetDraft(selection.hasSelection ? selection.content : '')}><Plus />New</button><input ref={componentInput} hidden type="file" accept="application/json,.json" onChange={(event) => void importComponents(event.target.files?.[0])} /></div>
      {state.components.length === 0 && <div className="component-empty-preview"><strong>No saved components yet.</strong><span>Create one from selected text or start from blank source.</span></div>}
      <div className="component-library">{state.components.map((definition) => <div className={`component-library-entry ${selectedComponentId === definition.id ? 'active' : ''}`} key={definition.id}><button onClick={() => chooseComponent(definition)}><Boxes /><span><strong>{definition.name}</strong><small>{definition.variables?.length ?? 0} variable{(definition.variables?.length ?? 0) === 1 ? '' : 's'} · {definition.mode.toUpperCase()}</small></span></button><button className="icon-button subtle" aria-label={`Edit component ${definition.name}`} onClick={() => editDefinition(definition)}><Pencil /></button><button className="icon-button subtle" aria-label={`Delete component ${definition.name}`} onClick={() => { workspaceActions.deleteComponent(definition.id); if (selectedComponentId === definition.id) setSelectedComponentId(null) }}><Trash2 /></button></div>)}</div>
      {selectedComponent && <div className="component-config">
        <div className="section-title-row"><div><h4>Preview {selectedComponent.name}</h4><p className="section-copy">Adjust values below. The saved definition is unchanged.</p></div><button className="icon-button" aria-label="Close component preview" onClick={() => setSelectedComponentId(null)}><X /></button></div>
        {(selectedComponent.variables ?? []).map((variable) => <ComponentValueField key={variable.id} variable={variable} value={componentValues[variable.name] ?? variable.defaultValue} onChange={(value) => setComponentValues((values) => ({ ...values, [variable.name]: value }))} />)}
        <ComponentPreview definition={selectedComponent} values={componentValues} assetUrls={state.assetObjectUrls} />
        <div className="button-row compact-row"><button className="button primary" onClick={() => insertComponent(selectedComponent)}><Link2 />Insert into document</button><button className="button secondary" onClick={() => editDefinition(selectedComponent)}><Pencil />Edit definition</button></div>
        <p className="section-copy">Inserted content stays linked locally. If you later edit this component, you can review the difference before updating existing uses.</p>
      </div>}
      {documentInstances.length > 0 && <details className="component-instances"><summary>Uses in this document <span>{documentInstances.length}</span></summary>{documentInstances.map((instance) => {
        const definition = state.components.find((candidate) => candidate.id === instance.definitionId)
        if (!definition) return null
        const next = componentUpdate(definition, instance)
        const outdated = next !== instance.renderedContent
        return <div className="component-instance" key={instance.id}><div><strong>{definition.name}</strong><small>{outdated ? 'Definition changed' : 'Up to date'} · {instance.mode}</small></div>{outdated && <details><summary>Compare changes</summary><span>Currently inserted</span><pre>{instance.renderedContent}</pre><span>Updated result</span><pre>{next}</pre></details>}<div className="button-row compact-row">{outdated && <button className="button secondary" onClick={() => setNotice(workspaceActions.applyComponentUpdate(instance.id) ? 'Linked use updated.' : 'The inserted source was edited manually, so it could not be updated automatically.')}><RefreshCw />Apply update</button>}<button className="button quiet" onClick={() => workspaceActions.detachComponentInstance(instance.id)}><Unlink />Stop tracking</button></div></div>
      })}</details>}
    </>}
  </section>
}
