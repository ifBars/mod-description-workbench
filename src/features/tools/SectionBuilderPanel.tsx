import { Plus } from 'lucide-react'
import { useState } from 'react'
import type { AuthoringMode } from '../../domain/types'
import { renderBBCode } from '../../markup/bbcode'
import { convertContent } from '../../markup/convert'
import { SECTION_BUILDERS, renderSectionBuilder, sectionBuilderDefinition, type SectionBuilderId } from './sectionBuilders'

interface SectionBuilderPanelProps { mode: AuthoringMode; onInsert: (snippet: string) => void }

export function SectionBuilderPanel({ mode, onInsert }: SectionBuilderPanelProps) {
  const [builderId, setBuilderId] = useState<SectionBuilderId>('hero')
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...sectionBuilderDefinition('hero').defaults }))
  const builder = sectionBuilderDefinition(builderId)
  const source = renderSectionBuilder(builderId, values)

  const chooseBuilder = (id: SectionBuilderId) => { const next = sectionBuilderDefinition(id); setBuilderId(id); setValues({ ...next.defaults }) }
  const updateValue = (key: string, nextValue: string) => setValues((current) => ({ ...current, [key]: nextValue }))
  const insert = () => onInsert(convertContent(source, 'bbcode', mode))

  return <section>
    <h3>Section builders</h3>
    <p className="section-copy">Build the kind of paced, branded sections used by ambitious Nexus descriptions without hand-nesting every tag.</p>
    <label>Section type<select value={builderId} onChange={(event) => chooseBuilder(event.target.value as SectionBuilderId)}>{SECTION_BUILDERS.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
    <p className="section-builder-description">{builder.description}</p>
    <div className="section-builder-fields">
      {builder.fields.map((field) => field.type === 'textarea'
        ? <label key={field.key}>{field.label}<textarea rows={field.rows ?? 5} value={values[field.key] ?? ''} placeholder={field.placeholder} onChange={(event) => updateValue(field.key, event.target.value)} /></label>
        : field.type === 'color'
          ? <label key={field.key}>{field.label}<span className="token-input"><input type="color" value={values[field.key] ?? '#d98f40'} onChange={(event) => updateValue(field.key, event.target.value)} /><input value={values[field.key] ?? ''} onChange={(event) => updateValue(field.key, event.target.value)} /></span></label>
          : <label key={field.key}>{field.label}<input value={values[field.key] ?? ''} placeholder={field.placeholder} onChange={(event) => updateValue(field.key, event.target.value)} /></label>)}
    </div>
    <div className="component-preview"><div className="component-preview-label"><strong>Live Nexus preview</strong><span>Updates as you type</span></div><div className="component-preview-surface"><div className="nexus-description">{renderBBCode(source)}</div></div><details><summary>Generated source</summary><pre>{source}</pre></details></div>
    <button className="button primary" onClick={insert}><Plus />Insert {builder.name.toLowerCase()} into document</button>
    {mode === 'markdown' && <p className="section-copy">Nexus-only styling stays as hybrid BBCode so switching authoring modes does not flatten the design.</p>}
  </section>
}
