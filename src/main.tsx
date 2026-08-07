import '@fontsource-variable/ibm-plex-sans'
import '@fontsource-variable/inter/opsz.css'
import '@fontsource-variable/inter/opsz-italic.css'
import '@fontsource/ibm-plex-mono/400.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { registerDesktopCloseLifecycle } from './platform/desktop'
import { workspaceActions } from './state/workspaceStore'
import './styles.css'

void registerDesktopCloseLifecycle({ flush: workspaceActions.flushPersistence, reportFailure: workspaceActions.reportCloseFlushFailure })
  .catch(() => workspaceActions.reportDesktopLifecycleFailure())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
