import type { MouseEvent } from 'react'
import { Minus, Square, X } from 'lucide-react'
import { desktopWindow } from '../platform/window'

type WindowAction = 'minimize' | 'toggleMaximize' | 'close'

export function DesktopTitlebar() {
  const runWindowAction = async (action: WindowAction) => {
    try {
      const window = await desktopWindow()
      await window?.[action]()
    } catch {
      // A native command can be unavailable while the desktop process exits.
    }
  }
  const startDrag = async (event: MouseEvent<HTMLElement>) => {
    if (event.button !== 0 || event.target instanceof Element && event.target.closest('button, input, select, textarea, a, [data-window-control]')) return
    try { await (await desktopWindow())?.startDragging() } catch { /* Window dragging is optional while a platform closes. */ }
  }
  const toggleMaximize = (event: MouseEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest('button, input, select, textarea, a, [data-window-control]')) return
    if (event.detail === 2) void runWindowAction('toggleMaximize')
  }

  return <header className="desktop-titlebar" onMouseDown={(event) => void startDrag(event)} onDoubleClick={toggleMaximize}>
    <div className="desktop-titlebar-app" aria-label="Mod Description Workbench"><span className="brand-mark">{'{}'}</span><span>Mod Description Workbench</span></div>
    <div className="desktop-titlebar-spacer" aria-hidden="true" />
    <div className="desktop-window-controls" aria-label="Window controls">
      <button type="button" data-window-control aria-label="Minimize window" title="Minimize" onClick={() => void runWindowAction('minimize')}><Minus /></button>
      <button type="button" data-window-control aria-label="Maximize or restore window" title="Maximize or restore" onClick={() => void runWindowAction('toggleMaximize')}><Square /></button>
      <button type="button" data-window-control className="desktop-close" aria-label="Close window" title="Close" onClick={() => void runWindowAction('close')}><X /></button>
    </div>
  </header>
}
