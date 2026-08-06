import { Accessibility, ArrowLeft, Boxes, Code2, Download, FilePlus2, HardDrive, Image, Info, Keyboard, MonitorCog, Palette, RotateCcw, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { DEFAULT_PREFERENCES } from '../../domain/defaults'
import type { AuthoringToolTab, CustomTheme, WorkspacePreferences } from '../../domain/types'
import { getWorkspaceSnapshot, useWorkspaceStore, workspaceActions } from '../../state/workspaceStore'
import { downloadWorkspaceBundle, readWorkspaceBundle } from '../../storage/bundle'

interface SettingsPageProps { preferences: WorkspacePreferences }

function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function SettingsPage({ preferences }: SettingsPageProps) {
  const [category, setCategory] = useState('appearance')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [resetDataPending, setResetDataPending] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const themeInput = useRef<HTMLInputElement>(null)
  const state = useWorkspaceStore()
  const customTheme = state.customThemes.find((candidate) => candidate.id === state.preferences.customThemeId)
  const categories = [
    ['appearance', Palette, 'Appearance'], ['editor', Code2, 'Editor'], ['preview', MonitorCog, 'Preview'],
    ['recovery', HardDrive, 'Autosave & recovery'], ['images', Image, 'Images'], ['libraries', Boxes, 'Templates & components'],
    ['accessibility', Accessibility, 'Accessibility'], ['keyboard', Keyboard, 'Keyboard'], ['privacy', ShieldCheck, 'Privacy & data'], ['about', Info, 'About'],
  ] as const
  const searchTerms: Record<string, string> = {
    appearance: 'theme light dark custom colour color import export tokens', editor: 'font size wrap source markdown bbcode visual',
    preview: 'nexus mobile desktop zoom device', recovery: 'autosave checkpoint crash draft restore retention', images: 'image local remote blob usage replace cleanup',
    libraries: 'template component reusable import export portable', accessibility: 'motion animation comfort contrast screen reader', keyboard: 'shortcut hotkey autocomplete find bold',
    privacy: 'local indexeddb workspace backup import export data analytics server reset delete', about: 'version nexus independent github pages local',
  }
  const localImageBytes = state.imageAssets.filter((asset) => asset.kind === 'local').reduce((total, asset) => total + asset.size, 0)

  const importWorkspace = async (file?: File) => {
    if (!file) return
    try {
      workspaceActions.replaceSnapshot(await readWorkspaceBundle(file))
      setNotice({ kind: 'success', text: 'Workspace imported.' })
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Workspace import failed.' })
    }
  }

  const importTheme = async (file?: File) => {
    if (!file) return
    try {
      const value = JSON.parse(await file.text()) as Partial<CustomTheme>
      const required = ['canvas', 'surfaceLow', 'surfaceRaised', 'border', 'text', 'muted', 'accent', 'accentHover', 'focus'] as const
      if (!value.tokens || !required.every((key) => /^#[0-9a-f]{6}$/i.test(value.tokens?.[key] ?? ''))) throw new Error('Invalid theme file.')
      const theme: CustomTheme = { id: crypto.randomUUID(), name: value.name?.slice(0, 60) || 'Imported theme', dark: value.dark ?? true, tokens: value.tokens }
      workspaceActions.addCustomTheme(theme)
      workspaceActions.selectCustomTheme(theme.id)
      setNotice({ kind: 'success', text: `Imported theme “${theme.name}”.` })
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Theme import failed.' })
    }
  }
  const openTools = (tab: AuthoringToolTab) => { workspaceActions.setScreen('workspace'); workspaceActions.openTools(tab) }
  const resetData = async () => {
    if (!resetDataPending) { setResetDataPending(true); return }
    await workspaceActions.resetAllData()
    setResetDataPending(false)
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
          {notice && <div className={`settings-notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</div>}
          {category === 'appearance' && <AppearanceSettings preferences={preferences} customTheme={customTheme} themes={state.customThemes} themeInput={themeInput} onImportTheme={importTheme} />}
          {category === 'editor' && <><SettingsHeading eyebrow="Authoring" title="Editor">Control source density and wrapping without changing exported content.</SettingsHeading><div className="settings-section form-grid"><label>Source font size<input type="number" min="11" max="22" value={preferences.editorFontSize} onChange={(event) => workspaceActions.updatePreferences({ editorFontSize: Number(event.target.value) })} /></label><SwitchRow title="Word wrap" description="Wrap long source lines in the editor" checked={preferences.wordWrap} onChange={(wordWrap) => workspaceActions.updatePreferences({ wordWrap })} /></div><CategoryReset label="editor" onClick={() => workspaceActions.updatePreferences({ editorFontSize: DEFAULT_PREFERENCES.editorFontSize, wordWrap: DEFAULT_PREFERENCES.wordWrap })} /></>}
          {category === 'preview' && <><SettingsHeading eyebrow="Compatibility" title="Preview">The Nexus skin remains independent from app themes.</SettingsHeading><div className="settings-section form-grid"><label>Default zoom<input type="range" min="70" max="130" value={preferences.previewZoom} onChange={(event) => workspaceActions.updatePreferences({ previewZoom: Number(event.target.value) })} /><output>{preferences.previewZoom}%</output></label><label>Editor share in split view<input type="range" min="35" max="70" value={preferences.splitRatio} onChange={(event) => workspaceActions.updatePreferences({ splitRatio: Number(event.target.value) })} /><output>{preferences.splitRatio}% editor</output></label></div><CategoryReset label="preview" onClick={() => workspaceActions.updatePreferences({ previewZoom: DEFAULT_PREFERENCES.previewZoom, previewDevice: DEFAULT_PREFERENCES.previewDevice, splitRatio: DEFAULT_PREFERENCES.splitRatio })} /></>}
          {category === 'recovery' && <><SettingsHeading eyebrow="Draft safety" title="Autosave & recovery">Edits are saved after a short idle delay, with recovery checkpoints retained locally.</SettingsHeading><div className="settings-section settings-facts"><div><strong>250 ms</strong><span>Autosave idle delay</span></div><div><strong>1.5 s</strong><span>Checkpoint delay after edits</span></div><div><strong>50</strong><span>Newest checkpoints retained</span></div></div><p className="section-copy">Open Documents in the workbench to restore a checkpoint. Export a workspace for a portable backup outside this browser profile.</p></>}
          {category === 'images' && <><SettingsHeading eyebrow="Local library" title="Images">Review private local blobs and public remote references from one library.</SettingsHeading><div className="settings-section settings-facts"><div><strong>{state.imageAssets.length}</strong><span>Total images</span></div><div><strong>{state.imageAssets.filter((asset) => asset.kind === 'local').length}</strong><span>Local-only files</span></div><div><strong>{Math.ceil(localImageBytes / 1024)} KB</strong><span>Tracked local size</span></div></div><button className="button secondary" onClick={() => openTools('images')}><Image />Open image library</button></>}
          {category === 'libraries' && <><SettingsHeading eyebrow="Reusable writing" title="Templates & components">Libraries remain local by default and can be exported as validated JSON files.</SettingsHeading><div className="settings-section settings-facts"><div><strong>{state.templates.length}</strong><span>Saved templates</span></div><div><strong>{state.components.length}</strong><span>Reusable components</span></div></div><div className="button-row"><button className="button secondary" onClick={() => openTools('templates')}><FilePlus2 />Open templates</button><button className="button secondary" onClick={() => openTools('components')}><Boxes />Open components</button></div></>}
          {category === 'accessibility' && <><SettingsHeading eyebrow="Comfort" title="Accessibility">Keyboard-visible controls, semantic landmarks, and reduced motion are first-class.</SettingsHeading><div className="settings-section"><SwitchRow title="Reduce motion" description="Remove drawer and mode transitions" checked={preferences.reducedMotion} onChange={(reducedMotion) => workspaceActions.updatePreferences({ reducedMotion })} /></div><CategoryReset label="accessibility" onClick={() => workspaceActions.updatePreferences({ reducedMotion: DEFAULT_PREFERENCES.reducedMotion })} /></>}
          {category === 'keyboard' && <><SettingsHeading eyebrow="Reference" title="Keyboard">Source editor shortcuts follow familiar code-editor conventions.</SettingsHeading><div className="settings-section shortcut-list"><div><span>Bold</span><kbd>Ctrl</kbd><kbd>B</kbd></div><div><span>Find</span><kbd>Ctrl</kbd><kbd>F</kbd></div><div><span>Autocomplete</span><kbd>Ctrl</kbd><kbd>Space</kbd></div></div></>}
          {category === 'privacy' && <><SettingsHeading eyebrow="Local first" title="Privacy & data">No account, analytics, publishing connection, or application server.</SettingsHeading><div className="settings-section"><div className="privacy-callout"><ShieldCheck /><span><strong>Your drafts stay on this device.</strong><small>Workspace data uses IndexedDB. Network requests only occur for assets you explicitly preview by URL.</small></span></div><div className="button-row"><button className="button secondary" onClick={() => void downloadWorkspaceBundle(getWorkspaceSnapshot())}><Download />Export workspace</button><button className="button secondary" onClick={() => fileInput.current?.click()}><Upload />Import workspace</button><input ref={fileInput} hidden type="file" accept=".mdw,application/json,.json" onChange={(event) => void importWorkspace(event.target.files?.[0])} /></div></div><div className="settings-section danger-zone"><h3>Reset local data</h3><p className="section-copy">Removes drafts, checkpoints, local images, custom themes, templates, and components from this browser, then creates a fresh starter document.</p><button className="button danger" onClick={() => void resetData()}><Trash2 />{resetDataPending ? 'Confirm reset all local data' : 'Reset all local data'}</button>{resetDataPending && <button className="button quiet" onClick={() => setResetDataPending(false)}>Cancel</button>}</div></>}
          {category === 'about' && <><SettingsHeading eyebrow="Independent tool" title="About">Mod Description Workbench is a static, local-first compatibility tool for manually authored mod descriptions.</SettingsHeading><div className="settings-section about-list"><p><strong>Version</strong><span>0.1.0</span></p><p><strong>Deployment</strong><span>Static GitHub Pages application</span></p><p><strong>Nexus access</strong><span>No login, scraping, editing, saving, or publishing automation</span></p></div></>}
        </section>
        <aside className="settings-preview"><span className="eyebrow">Live preview</span><div className="mini-workbench"><div className="mini-header"><i />Mod Description Workbench</div><div className="mini-body"><span /><span /><span className="accent" /><span /></div></div><p>Changes apply immediately and save locally.</p></aside>
      </div>
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

function AppearanceSettings({ preferences, customTheme, themes, themeInput, onImportTheme }: { preferences: WorkspacePreferences; customTheme: CustomTheme | undefined; themes: CustomTheme[]; themeInput: React.RefObject<HTMLInputElement | null>; onImportTheme: (file?: File) => Promise<void> }) {
  return <>
    <SettingsHeading eyebrow="Personalisation" title="Appearance">Choose a built-in theme or tune every app-shell colour. The Nexus preview skin stays fixed.</SettingsHeading>
    <div className="settings-section"><h3>Theme</h3><div className="theme-grid">{(['system', 'dark', 'light'] as const).map((theme) => <button className={`theme-choice ${preferences.theme === theme && !preferences.customThemeId ? 'active' : ''}`} key={theme} onClick={() => workspaceActions.setTheme(theme)}><span className={`theme-swatch ${theme}`}><i /><i /><i /></span><strong>{theme.charAt(0).toUpperCase() + theme.slice(1)}</strong><small>{theme === 'dark' ? 'Cursor-like charcoal' : theme === 'light' ? 'True white and cool gray' : 'Follow this device'}</small></button>)}</div></div>
    <div className="settings-section custom-theme-section">
      <div className="section-title-row"><div><h3>Custom themes</h3><p className="section-copy">Create, edit, export, and import portable JSON themes.</p></div><button className="button secondary" onClick={() => workspaceActions.createCustomTheme(preferences.theme !== 'light')}><FilePlus2 />New theme</button></div>
      {themes.length > 0 && <select value={customTheme?.id ?? ''} onChange={(event) => workspaceActions.selectCustomTheme(event.target.value)}><option value="" disabled>Select a custom theme</option>{themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select>}
      {customTheme && <div className="theme-token-editor"><label>Theme name<input value={customTheme.name} onChange={(event) => workspaceActions.updateCustomTheme(customTheme.id, { name: event.target.value })} /></label>{(Object.keys(customTheme.tokens) as Array<keyof typeof customTheme.tokens>).map((token) => <label key={token}>{token.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}<span className="token-input"><input type="color" value={customTheme.tokens[token]} onChange={(event) => workspaceActions.updateCustomTheme(customTheme.id, { tokens: { ...customTheme.tokens, [token]: event.target.value } })} /><input value={customTheme.tokens[token]} onChange={(event) => /^#[0-9a-f]{6}$/i.test(event.target.value) && workspaceActions.updateCustomTheme(customTheme.id, { tokens: { ...customTheme.tokens, [token]: event.target.value } })} /></span></label>)}</div>}
      <div className="button-row"><button className="button secondary" disabled={!customTheme} onClick={() => customTheme && downloadJson(`${customTheme.name.replace(/\W+/g, '-').toLowerCase()}.mdw-theme.json`, customTheme)}><Download />Export theme</button><button className="button secondary" onClick={() => themeInput.current?.click()}><Upload />Import theme</button>{customTheme && <button className="button danger" onClick={() => workspaceActions.deleteCustomTheme(customTheme.id)}><Trash2 />Delete</button>}<input ref={themeInput} hidden type="file" accept="application/json,.json" onChange={(event) => void onImportTheme(event.target.files?.[0])} /></div>
    </div>
    <CategoryReset label="appearance" onClick={() => workspaceActions.setTheme(DEFAULT_PREFERENCES.theme)} />
  </>
}
