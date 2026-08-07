import { WorkspacePage } from './pages/WorkspacePage'
import { DesktopTitlebar } from './components/DesktopTitlebar'
import { platformRuntime } from './platform/runtime'

export function App() {
  if (platformRuntime() === 'browser') return <WorkspacePage />
  return <div className="desktop-app"><DesktopTitlebar /><main className="desktop-content"><WorkspacePage /></main></div>
}
