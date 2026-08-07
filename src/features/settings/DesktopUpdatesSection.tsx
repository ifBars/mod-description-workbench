import { CircleArrowUp, Download, RefreshCw, RotateCw } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'
import { UpdateController, type UpdateState } from '../../platform/updater/controller'
import { updaterPlatform } from '../../platform/updater'

const desktopUpdateController = new UpdateController(updaterPlatform)

function updateMessage(state: UpdateState) {
  if (state.status === 'checking') return 'Checking the signed release channel…'
  if (state.status === 'current') return state.currentVersion ? `Version ${state.currentVersion} is current.` : 'This desktop app is current.'
  if (state.status === 'downloading') return 'Downloading and verifying the signed update…'
  if (state.status === 'ready') return 'The update is installed and ready to restart.'
  if (state.status === 'restarting') return 'Restarting to finish the update…'
  return state.error
}

function progressLabel(state: UpdateState) {
  if (!state.contentLength || state.contentLength <= 0) return `${Math.ceil(state.downloadedBytes / 1024)} KB downloaded`
  const percent = Math.min(100, Math.round((state.downloadedBytes / state.contentLength) * 100))
  return `${percent}% downloaded`
}

function formattedDate(date: string | null) {
  if (!date) return null
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString()
}

export function DesktopUpdatesSection({ controller = desktopUpdateController }: { controller?: UpdateController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const [confirmingInstall, setConfirmingInstall] = useState(false)
  const busy = state.status === 'checking' || state.status === 'downloading' || state.status === 'restarting'
  const published = formattedDate(state.update?.date ?? null)

  return <>
    <SettingsHeading eyebrow="Desktop" title="Updates">Check the signed GitHub release channel when you decide. Downloads and restart always need your confirmation.</SettingsHeading>
    <div className="settings-section desktop-update-section">
      <div className="section-title-row"><div><h3>Signed updates</h3><p className="section-copy">Updates are verified with the desktop app’s release key before installation.</p></div><button className="button secondary" disabled={busy} onClick={() => { setConfirmingInstall(false); void controller.check() }}><RefreshCw />{state.status === 'checking' ? 'Checking…' : 'Check for updates'}</button></div>
      {updateMessage(state) && <p className={`inline-notice ${state.status === 'error' ? 'error' : ''}`} role={state.status === 'error' ? 'alert' : 'status'}>{updateMessage(state)}</p>}
      {state.status === 'downloading' && <div className="update-progress" aria-label={progressLabel(state)}><div><span style={state.contentLength ? { width: `${Math.min(100, (state.downloadedBytes / state.contentLength) * 100)}%` } : undefined} /></div><small>{progressLabel(state)}</small></div>}
      {state.update && <div className="update-summary"><strong>Version {state.update.version} is available.</strong>{published && <small>Published {published}</small>}{state.update.notes && <p>{state.update.notes}</p>}</div>}
      {state.status === 'available' && !confirmingInstall && <button className="button primary" disabled={busy} onClick={() => setConfirmingInstall(true)}><Download />Download update</button>}
      {state.status === 'available' && confirmingInstall && <div className="update-confirmation" role="region" aria-label="Confirm update installation"><p>Download, verify, and install version {state.update?.version}. The app will not restart until you choose it below.</p><div className="button-row"><button className="button secondary" onClick={() => setConfirmingInstall(false)}>Not now</button><button className="button primary" onClick={() => { setConfirmingInstall(false); void controller.install() }}><CircleArrowUp />Install update</button></div></div>}
      {state.status === 'ready' && <button className="button primary" disabled={busy} onClick={() => void controller.restart()}><RotateCw />Restart to finish update</button>}
    </div>
  </>
}

function SettingsHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <div className="settings-heading"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{children}</p></div>
}
