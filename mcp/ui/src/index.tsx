import {
  App,
  PostMessageTransport,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
} from '@modelcontextprotocol/ext-apps'
import { createRoot } from 'react-dom/client'
import packageJson from '../../../package.json'
import type { PreviewDevice } from '../../../src/domain/types'
import { NexusDescriptionSurface } from '../../../src/features/preview/NexusDescriptionSurface'
import { copyText } from './clipboard'

interface PreviewResult {
  bbcode?: string
  issues?: string[]
}

const root = createRoot(document.getElementById('root')!)
const app = new App({ name: 'Nexus Description Preview', version: packageJson.version }, {}, { autoResize: true })
let result: PreviewResult = {}
let device: PreviewDevice = 'desktop'
let copyState = 'Copy BBCode'

function copyBBCode() {
  if (!result.bbcode) return
  void copyText(result.bbcode).then(() => {
    copyState = 'Copied'
    render()
    window.setTimeout(() => {
      copyState = 'Copy BBCode'
      render()
    }, 1_200)
  }).catch(() => {
    copyState = 'Copy failed'
    render()
  })
}

function requestFullscreen() {
  void app.requestDisplayMode({ mode: 'fullscreen' }).catch(() => undefined)
}

function render() {
  const issues = result.issues ?? []
  const bbcode = result.bbcode ?? ''
  root.render(
    <main className="widget-shell">
      <header className="widget-toolbar">
        <div className="widget-heading">
          <strong>Nexus preview</strong>
          <span className={issues.length ? 'status warning' : 'status'}>{issues.length ? `${issues.length} issue${issues.length === 1 ? '' : 's'}` : 'Ready to paste'}</span>
        </div>
        <div className="widget-actions">
          <div className="device-switch" aria-label="Preview width">
            <button type="button" className={device === 'desktop' ? 'active' : ''} onClick={() => { device = 'desktop'; render() }}>Desktop</button>
            <button type="button" className={device === 'mobile' ? 'active' : ''} onClick={() => { device = 'mobile'; render() }}>Mobile</button>
          </div>
          <button type="button" onClick={requestFullscreen}>Expand</button>
          <button type="button" className="primary" disabled={!bbcode} onClick={copyBBCode}>{copyState}</button>
        </div>
      </header>
      {issues.length > 0 && <details className="issues"><summary>Compatibility issues</summary><ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></details>}
      <div className="widget-stage">
        {bbcode
          ? <NexusDescriptionSurface bbcode={bbcode} device={device} fluidDesktop={device === 'desktop'} />
          : <div className="empty-preview">Waiting for Nexus BBCode…</div>}
      </div>
      {bbcode && <details className="source"><summary>View source BBCode</summary><pre>{bbcode}</pre></details>}
    </main>,
  )
}

function applyHostContext(context: ReturnType<typeof app.getHostContext>) {
  if (!context) return
  if (context.theme) applyDocumentTheme(context.theme)
  if (context.styles?.variables) applyHostStyleVariables(context.styles.variables)
  if (context.styles?.css?.fonts) applyHostFonts(context.styles.css.fonts)
}

app.ontoolinput = () => {
  result = {}
  render()
}
app.ontoolresult = (params) => {
  result = (params.structuredContent ?? {}) as PreviewResult
  render()
}
app.onhostcontextchanged = applyHostContext
app.onteardown = async () => ({})

const previewResult: PreviewResult = {
  bbcode: '[center][size=6][b]Signal Relay[/b][/size]\n[size=4][i]Clear radio status at a glance.[/i][/size][/center]\n[line]\n\n[heading][size=5]Overview[/size][/heading]\nA focused quality-of-life mod that makes radio state easier to understand.\n\n[heading][size=5]Features[/size][/heading]\n[list]\n[*]Shows the active channel clearly\n[*]Coalesces repeated status notices\n[/list]\n\n[heading][size=5]Installation[/size][/heading]\n[list=1]\n[*]Install the supported mod loader\n[*]Place SignalRelay.dll in the Mods folder\n[/list]',
  issues: [],
}

if (window.parent === window || new URLSearchParams(location.search).has('preview')) {
  document.body.dataset.preview = 'true'
  result = previewResult
  render()
} else {
  render()
  void app.connect(new PostMessageTransport(window.parent, window.parent))
    .then(() => applyHostContext(app.getHostContext()))
    .catch(() => {
      result = previewResult
      render()
    })
}
