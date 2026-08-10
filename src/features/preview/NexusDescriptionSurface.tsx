import type { CSSProperties, MouseEvent } from 'react'
import type { PreviewDevice } from '../../domain/types'
import { renderBBCode } from '../../markup/bbcode'

interface NexusDescriptionSurfaceProps {
  bbcode: string
  device: PreviewDevice
  scale?: number
  fluidDesktop?: boolean
  assetUrls?: Record<string, string>
  onExternalLink?: ((event: MouseEvent<HTMLAnchorElement>) => void) | undefined
}

export function NexusDescriptionSurface({
  bbcode,
  device,
  scale = 1,
  fluidDesktop = false,
  assetUrls = {},
  onExternalLink,
}: NexusDescriptionSurfaceProps) {
  return (
    <article
      className={`nexus-surface ${device} ${device === 'desktop' && fluidDesktop ? 'fluid-desktop' : ''}`}
      style={{ '--preview-zoom': scale, '--preview-fit': 1, '--preview-scale': scale } as CSSProperties}
    >
      <div className="nexus-description">{renderBBCode(bbcode, assetUrls, onExternalLink)}</div>
    </article>
  )
}
