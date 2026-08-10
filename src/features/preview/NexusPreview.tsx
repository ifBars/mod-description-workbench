import { useCallback, useRef, useState } from 'react'
import { Monitor, Smartphone } from 'lucide-react'
import type { AuthoringMode, PreviewDevice } from '../../domain/types'
import { bbcodeDiagnostics } from '../../markup/bbcode'
import { normalizeForNexus } from '../../markup/convert'
import { routeExternalLink } from '../../platform/externalLinks'
import { NexusDescriptionSurface } from './NexusDescriptionSurface'

interface NexusPreviewProps {
  content: string
  mode: AuthoringMode
  device: PreviewDevice
  zoom: number
  fluidDesktop?: boolean
  onDeviceChange: (device: PreviewDevice) => void
  assetUrls?: Record<string, string>
  nexusContent?: string | undefined
}

function contentWidth(element: HTMLElement) {
  const style = getComputedStyle(element)
  return element.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight)
}

export function NexusPreview({ content, mode, device, zoom, fluidDesktop = false, onDeviceChange, assetUrls = {}, nexusContent }: NexusPreviewProps) {
  const nexusSource = nexusContent ?? normalizeForNexus(content, mode)
  const issues = [...bbcodeDiagnostics(nexusSource), ...(content.includes('asset://') ? ['Local images need public URLs before Nexus export'] : [])]
  const [availableWidth, setAvailableWidth] = useState(0)
  const observerRef = useRef<ResizeObserver | null>(null)
  const baselineDevicePixelRatio = useRef(typeof window === 'undefined' ? 1 : window.devicePixelRatio)
  const stageRef = useCallback((element: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!element) return

    const updateWidth = () => {
      // Browser zoom changes devicePixelRatio and the CSS viewport width at the
      // same time. Re-fitting in that state would cancel the user's zoom.
      if (Math.abs(window.devicePixelRatio - baselineDevicePixelRatio.current) > 0.01) return
      const nextWidth = Math.max(0, Math.floor(contentWidth(element)))
      setAvailableWidth((currentWidth) => currentWidth === nextWidth ? currentWidth : nextWidth)
    }
    updateWidth()
    if (typeof ResizeObserver !== 'undefined') {
      observerRef.current = new ResizeObserver(updateWidth)
      observerRef.current.observe(element)
    }
  }, [])
  const usesFluidDesktop = device === 'desktop' && fluidDesktop
  const surfaceWidth = device === 'mobile' ? 375.2 : 1240
  const fitScale = usesFluidDesktop ? 1 : availableWidth > 0 ? Math.min(1, availableWidth / surfaceWidth) : 1
  const previewScale = fitScale * zoom / 100
  return (
    <section className="preview-pane" aria-label="Nexus preview">
      <header className="pane-header preview-header">
        <div><span className="pane-title">Nexus preview</span><span className={`compatibility ${issues.length ? 'warning' : ''}`}>{issues.length ? `${issues.length} issue${issues.length === 1 ? '' : 's'}` : 'No compatibility issues'}</span></div>
        <div className="segmented compact">
          <button className={device === 'desktop' ? 'active' : ''} onClick={() => onDeviceChange('desktop')}><Monitor />Desktop</button>
          <button className={device === 'mobile' ? 'active' : ''} onClick={() => onDeviceChange('mobile')}><Smartphone />Mobile</button>
        </div>
      </header>
      <div className="preview-stage" ref={stageRef}>
        <NexusDescriptionSurface bbcode={nexusSource} device={device} scale={previewScale} fluidDesktop={usesFluidDesktop} assetUrls={assetUrls} onExternalLink={routeExternalLink} />
      </div>
    </section>
  )
}
