import { Accessibility, AlertTriangle, ArrowLeft, Boxes, Code2, Download, FilePlus2, HardDrive, Image, Keyboard, MonitorCog, Palette, RotateCcw, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'
import { DEFAULT_PREFERENCES } from '../../domain/defaults'
import type { AuthoringToolTab, CustomTheme, WorkspacePreferences } from '../../domain/types'
import { getWorkspaceSnapshot, useWorkspaceStore, workspaceActions } from '../../state/workspaceStore'
import { filePlatform } from '../../platform/files'
import { platformRuntime } from '../../platform/runtime'
import { WORKSPACE_IMPORT_FILTERS, readWorkspaceBundle, saveWorkspaceBundle } from '../../storage/bundle'
import { THEME_FILTERS, readThemeFile, saveTheme } from '../../storage/themeFile'
import { DesktopUpdatesSection } from './DesktopUpdatesSection'

export function SettingsPage() {
  const [category, setCategory] = useState('appearance')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [resetDataDialogOpen, setResetDataDialogOpen] = useState(false)
  const state = useWorkspaceStore()
  const preferences = state.preferences
  const customTheme = state.customThemes.find((candidate) => candidate.id === state.preferences.customThemeId)
  const isDesktop = platformRuntime() === 'tauri'
  const categories = [
    ['appearance', Palette, 'Appearance'], ['editor', Code2, 'Editor'], ['preview', MonitorCog, 'Preview'],
    ['recovery', HardDrive, 'Autosave & recovery'], ['images', Image, 'Images'], ['libraries', Boxes, 'Templates & components'],
    ['accessibility', Accessibility, 'Accessibility'], ['keyboard', Keyboard, 'Keyboard'], ['privacy', ShieldCheck, 'Privacy & data'],
    ...(isDesktop ? [['desktop', Download, 'Desktop updates'] as const] : []),
  ] as const
  const searchTerms: Record<string, string> = {
    appearance: 'theme light dark custom colour color import export tokens', editor: 'font size wrap source markdown bbcode visual',
    preview: 'nexus mobile desktop zoom device', recovery: 'autosave checkpoint crash draft restore retention', images: 'image local remote blob usage replace cleanup',
    libraries: 'template component reusable import export portable', accessibility: 'motion animation comfort contrast screen reader', keyboard: 'shortcut hotkey autocomplete find bold undo redo indent search',
    privacy: 'local indexeddb workspace backup import export data analytics server reset delete', desktop: 'desktop signed update github release download install restart version',
  }
  const localImageBytes = state.imageAssets.filter((asset) => asset.kind === 'local').reduce((total, asset) => total + asset.size, 0)

  const importWorkspace = async () => {
    try {
      const selection = await (await filePlatform()).chooseFile({ filters: WORKSPACE_IMPORT_FILTERS })
      if (selection.cancelled) return
      workspaceActions.replaceSnapshot(await readWorkspaceBundle(selection.file))
      setNotice({ kind: 'success', text: 'Workspace imported.' })
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Workspace import failed.' })
    }
  }

  const importTheme = async () => {
    try {
      const selection = await (await filePlatform()).chooseFile({ filters: THEME_FILTERS })
      if (selection.cancelled) return
      const theme = await readThemeFile(selection.file)
      workspaceActions.addCustomTheme(theme)
      workspaceActions.selectCustomTheme(theme.id)
      setNotice({ kind: 'success', text: `Imported theme “${theme.name}”.` })
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Theme import failed.' })
    }
  }
  const exportWorkspace = async () => {
    try {
      const result = await saveWorkspaceBundle(getWorkspaceSnapshot())
      if (result.cancelled) return
      setNotice({ kind: 'success', text: 'Workspace exported.' })
    } catch { setNotice({ kind: 'error', text: 'Workspace export failed.' }) }
  }
  const exportTheme = async (theme: CustomTheme) => {
    try {
      const result = await saveTheme(theme)
      if (result.cancelled) return
      setNotice({ kind: 'success', text: 'Theme exported.' })
    } catch { setNotice({ kind: 'error', text: 'Theme export failed.' }) }
  }
  const openTools = (tab: AuthoringToolTab) => { workspaceActions.setScreen('workspace'); workspaceActions.openTools(tab) }
  const resetData = async () => {
    await workspaceActions.resetAllData()
    setResetDataDialogOpen(false)
    setNotice({ kind: 'success', text: 'All local workspace data was reset.' })
  }

  return (
    <main className="settings-page">
      <header className="settings-topbar">
        <button className="button quiet" onClick={() => workspaceActions.setScreen('workspace')}><ArrowLeft />Back to editor</button>
        <div><span className="brand-mark">{'{}'}</span><strong>Mod Description Workbench</strong></div>
        <button className="button secondary" onClick={() => workspaceActions.updatePreferences(DEFAULT_PREFERENCES)}><RotateCcw />Reset settings</button>
      </header>
      <div className="settings-layout">
        <aside className="settings-nav">
          <h1>Settings</h1>
          <input className="settings-search" type="search" placeholder="Search settings" value={query} onChange={(event) => setQuery(event.target.value)} />
          <nav>{categories.filter(([id, , label]) => `${label} ${searchTerms[id]}`.toLowerCase().includes(query.toLowerCase())).map(([id, Icon, label]) => <button className={category === id ? 'active' : ''} key={id} onClick={() => setCategory(id)}><Icon />{label}</button>)}</nav>
        </aside>
        <section className="settings-content">
          {state.saveState === 'error' && <div className="settings-notice error" role="alert">{state.saveError ?? 'Could not save locally. Try again.'}</div>}
          {notice && <div className={`settings-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</div>}
          {category === 'appearance' && <AppearanceSettings preferences={preferences} customTheme={customTheme} themes={state.customThemes} onImportTheme={importTheme} onExportTheme={exportTheme} />}
          {category === 'editor' && <><SettingsHeading eyebrow="Authoring" title="Editor">Control source density and wrapping without changing exported content.</SettingsHeading><div className="settings-section form-grid"><label>Source font size<input type="number" min="11" max="22" value={preferences.editorFontSize} onChange={(event) => { const size = event.currentTarget.valueAsNumber; if (Number.isFinite(size) && size >= 11 && size <= 22) workspaceActions.updatePreferences({ editorFontSize: size }) }} /></label><SwitchRow title="Word wrap" description="Wrap long source lines in the editor" checked={preferences.wordWrap} onChange={(wordWrap) => workspaceActions.updatePreferences({ wordWrap })} /></div><CategoryReset label="editor" onClick={() => workspaceActions.updatePreferences({ editorFontSize: DEFAULT_PREFERENCES.editorFontSize, wordWrap: DEFAULT_PREFERENCES.wordWrap })} /></>}
          {category === 'preview' && <><SettingsHeading eyebrow="Compatibility" title="Preview">The Nexus skin remains independent from app themes.</SettingsHeading><div className="settings-section form-grid"><label>Default zoom<input type="range" min="70" max="130" value={preferences.previewZoom} onChange={(event) => workspaceActions.updatePreferences({ previewZoom: Number(event.target.value) })} /><output>{preferences.previewZoom}%</output></label><label>Editor share in split view<input type="range" min="35" max="70" value={preferences.splitRatio} onChange={(event) => workspaceActions.updatePreferences({ splitRatio: Number(event.target.value) })} /><output>{preferences.splitRatio}% editor</output></label></div><CategoryReset label="preview" onClick={() => workspaceActions.updatePreferences({ previewZoom: DEFAULT_PREFERENCES.previewZoom, previewDevice: DEFAULT_PREFERENCES.previewDevice, splitRatio: DEFAULT_PREFERENCES.splitRatio })} /></>}
          {category === 'recovery' && <><SettingsHeading eyebrow="Draft safety" title="Autosave & recovery">Choose how quickly drafts save and how much local recovery history the workbench keeps.</SettingsHeading><div className="settings-section form-grid"><label>Save after you stop typing<select aria-label="Autosave idle delay" value={preferences.autosaveDelayMs} onChange={(event) => workspaceActions.updatePreferences({ autosaveDelayMs: Number(event.target.value) })}><option value={100}>0.1 seconds</option><option value={250}>0.25 seconds</option><option value={500}>0.5 seconds</option><option value={1000}>1 second</option><option value={2000}>2 seconds</option><option value={5000}>5 seconds</option></select><span className="field-note">Applies to documents, libraries, and settings.</span></label><SwitchRow title="Recovery checkpoints" description="Keep earlier document versions that can be restored from Documents" checked={preferences.recoveryEnabled} onChange={(recoveryEnabled) => workspaceActions.updatePreferences({ recoveryEnabled })} />{preferences.recoveryEnabled && <><label>Create a checkpoint after<select aria-label="Recovery checkpoint delay" value={preferences.checkpointDelayMs} onChange={(event) => workspaceActions.updatePreferences({ checkpointDelayMs: Number(event.target.value) })}><option value={1000}>1 second without edits</option><option value={1500}>1.5 seconds without edits</option><option value={3000}>3 seconds without edits</option><option value={5000}>5 seconds without edits</option><option value={10000}>10 seconds without edits</option><option value={30000}>30 seconds without edits</option><option value={60000}>1 minute without edits</option></select></label><label>Recovery points to keep<input aria-label="Recovery points to keep" type="number" min="5" max="100" step="5" value={preferences.checkpointRetention} onChange={(event) => workspaceActions.updatePreferences({ checkpointRetention: Math.min(100, Math.max(5, Number(event.target.value) || 5)) })} /><span className="field-note">Oldest checkpoints are removed first across the workspace.</span></label></>}</div><p className="section-copy">Open Documents in the workbench to restore a checkpoint. Export a workspace for a portable backup outside this browser profile.</p><CategoryReset label="autosave and recovery" onClick={() => workspaceActions.updatePreferences({ autosaveDelayMs: DEFAULT_PREFERENCES.autosaveDelayMs, recoveryEnabled: DEFAULT_PREFERENCES.recoveryEnabled, checkpointDelayMs: DEFAULT_PREFERENCES.checkpointDelayMs, checkpointRetention: DEFAULT_PREFERENCES.checkpointRetention })} /></>}
          {category === 'images' && <><SettingsHeading eyebrow="Local library" title="Images">Review private local blobs and public remote references from one library.</SettingsHeading><div className="settings-section settings-facts"><div><strong>{state.imageAssets.length}</strong><span>Total images</span></div><div><strong>{state.imageAssets.filter((asset) => asset.kind === 'local').length}</strong><span>Local-only files</span></div><div><strong>{Math.ceil(localImageBytes / 1024)} KB</strong><span>Tracked local size</span></div></div><button className="button secondary" onClick={() => openTools('images')}><Image />Open image library</button></>}
          {category === 'libraries' && <><SettingsHeading eyebrow="Reusable writing" title="Templates & components">Libraries remain local by default and can be exported as validated JSON files.</SettingsHeading><div className="settings-section settings-facts"><div><strong>{state.templates.length}</strong><span>Saved templates</span></div><div><strong>{state.components.length}</strong><span>Reusable components</span></div></div><div className="button-row"><button className="button secondary" onClick={() => openTools('templates')}><FilePlus2 />Open templates</button><button className="button secondary" onClick={() => openTools('components')}><Boxes />Open components</button></div></>}
          {category === 'accessibility' && <><SettingsHeading eyebrow="Comfort" title="Accessibility">Keyboard-visible controls, semantic landmarks, and reduced motion are first-class.</SettingsHeading><div className="settings-section"><SwitchRow title="Reduce motion" description="Remove animations and transitions throughout the app" checked={preferences.reducedMotion} onChange={(reducedMotion) => workspaceActions.updatePreferences({ reducedMotion })} /></div><CategoryReset label="accessibility" onClick={() => workspaceActions.updatePreferences({ reducedMotion: DEFAULT_PREFERENCES.reducedMotion })} /></>}
          {category === 'keyboard' && <><SettingsHeading eyebrow="Reference" title="Keyboard">Shortcuts available while the source editor is focused.</SettingsHeading><div className="settings-section shortcut-list"><Shortcut label="Bold" keys={['Ctrl', 'B']} /><Shortcut label="Undo" keys={['Ctrl', 'Z']} /><Shortcut label="Redo" keys={['Ctrl', 'Y']} /><Shortcut label="Find" keys={['Ctrl', 'F']} /><Shortcut label="Find next" keys={['Ctrl', 'G']} /><Shortcut label="Find previous" keys={['Ctrl', 'Shift', 'G']} /><Shortcut label="Select all" keys={['Ctrl', 'A']} /><Shortcut label="Indent line or selection" keys={['Tab']} /><Shortcut label="Outdent line or selection" keys={['Shift', 'Tab']} /><Shortcut label="BBCode autocomplete" keys={['Ctrl', 'Space']} /></div></>}
          {category === 'privacy' && <><SettingsHeading eyebrow="Local first" title="Privacy & data">No account, analytics, publishing connection, or application server.</SettingsHeading><div className="settings-section"><div className="privacy-callout"><ShieldCheck /><span><strong>Your drafts stay on this device.</strong><small>Workspace data uses IndexedDB. Network requests only occur for assets you explicitly preview by URL.</small></span></div><div className="button-row"><button className="button secondary" onClick={() => void exportWorkspace()}><Download />Export workspace</button><button className="button secondary" onClick={() => void importWorkspace()}><Upload />Import workspace</button></div></div><div className="settings-section danger-zone"><h3>Reset local data</h3><p className="section-copy">Removes drafts, checkpoints, local images, custom themes, templates, components, and preferences from this browser, then creates a fresh starter document.</p><button className="button danger" aria-haspopup="dialog" onClick={() => setResetDataDialogOpen(true)}><Trash2 />Reset all local data</button></div></>}
          {category === 'desktop' && isDesktop && <DesktopUpdatesSection />}
        </section>
        <aside className="settings-preview"><span className="eyebrow">Live preview</span><div className="mini-workbench"><div className="mini-header"><i />Mod Description Workbench</div><div className="mini-body"><span /><span /><span className="accent" /><span /></div></div><p>Changes apply immediately and save locally.</p></aside>
      </div>
      {resetDataDialogOpen && <div className="confirmation-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setResetDataDialogOpen(false) }}><section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reset-data-title" aria-describedby="reset-data-description" onKeyDown={(event) => { if (event.key === 'Escape') setResetDataDialogOpen(false) }}><AlertTriangle /><div><span className="eyebrow">Permanent action</span><h2 id="reset-data-title">Reset all local data?</h2><p id="reset-data-description">Everything stored by Mod Description Workbench in this browser will be wiped: every draft, recovery checkpoint, local image, theme, template, component, and preference. This cannot be undone.</p><p>Export your workspace first if you may need any of it later.</p><div className="button-row"><button className="button secondary" autoFocus onClick={() => setResetDataDialogOpen(false)}>Cancel</button><button className="button danger" onClick={() => void resetData()}><Trash2 />Reset everything</button></div></div></section></div>}
    </main>
  )
}

function SettingsHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <div className="settings-heading"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{children}</p></div>
}

function SwitchRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="switch-row"><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>
}

function CategoryReset({ label, onClick }: { label: string; onClick: () => void }) {
  return <div className="category-reset"><button className="button quiet" onClick={onClick}><RotateCcw />Reset {label} settings</button></div>
}

function Shortcut({ label, keys }: { label: string; keys: string[] }) {
  return <div><span>{label}</span>{keys.map((key) => <kbd key={key}>{key}</kbd>)}</div>
}

function AppearanceSettings({ preferences, customTheme, themes, onImportTheme, onExportTheme }: { preferences: WorkspacePreferences; customTheme: CustomTheme | undefined; themes: CustomTheme[]; onImportTheme: () => Promise<void>; onExportTheme: (theme: CustomTheme) => Promise<void> }) {
  return <>
    <SettingsHeading eyebrow="Personalisation" title="Appearance">Choose a built-in theme or tune every app-shell colour. The Nexus preview skin stays fixed.</SettingsHeading>
    <div className="settings-section"><h3>Theme</h3><div className="theme-grid">{(['system', 'dark', 'light'] as const).map((theme) => <button className={`theme-choice ${preferences.theme === theme && !preferences.customThemeId ? 'active' : ''}`} key={theme} onClick={() => workspaceActions.setTheme(theme)}><span className={`theme-swatch ${theme}`}><i /><i /><i /></span><strong>{theme.charAt(0).toUpperCase() + theme.slice(1)}</strong><small>{theme === 'dark' ? 'Cursor-like charcoal' : theme === 'light' ? 'True white and cool gray' : 'Follow this device'}</small></button>)}</div></div>
    <div className="settings-section custom-theme-section">
      <div className="section-title-row"><div><h3>Custom themes</h3><p className="section-copy">Create, edit, export, and import portable JSON themes.</p></div><button className="button secondary" onClick={() => workspaceActions.createCustomTheme(preferences.theme !== 'light')}><FilePlus2 />New theme</button></div>
      {themes.length > 0 && <select value={customTheme?.id ?? ''} onChange={(event) => workspaceActions.selectCustomTheme(event.target.value)}><option value="" disabled>Select a custom theme</option>{themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select>}
      {customTheme && <div className="theme-token-editor"><label>Theme name<input value={customTheme.name} onChange={(event) => workspaceActions.updateCustomTheme(customTheme.id, { name: event.target.value })} /></label>{(Object.keys(customTheme.tokens) as Array<keyof typeof customTheme.tokens>).map((token) => { const label = token.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`); return <fieldset key={token}><legend>{label}</legend><span className="token-input"><input aria-label={`${label} colour picker`} type="color" value={customTheme.tokens[token]} onChange={(event) => workspaceActions.updateCustomTheme(customTheme.id, { tokens: { ...customTheme.tokens, [token]: event.target.value } })} /><input aria-label={`${label} hex value`} value={customTheme.tokens[token]} onChange={(event) => /^#[0-9a-f]{6}$/i.test(event.target.value) && workspaceActions.updateCustomTheme(customTheme.id, { tokens: { ...customTheme.tokens, [token]: event.target.value } })} /></span></fieldset> })}</div>}
      <div className="button-row"><button className="button secondary" disabled={!customTheme} onClick={() => customTheme && void onExportTheme(customTheme)}><Download />Export theme</button><button className="button secondary" onClick={() => void onImportTheme()}><Upload />Import theme</button>{customTheme && <button className="button danger" onClick={() => workspaceActions.deleteCustomTheme(customTheme.id)}><Trash2 />Delete</button>}</div>
    </div>
    <CategoryReset label="appearance" onClick={() => workspaceActions.setTheme(DEFAULT_PREFERENCES.theme)} />
  </>
}
