import type { DescriptionDocument, ImageAsset } from './types'
import { normalizeForNexus } from '../markup/convert'

export const MAX_LOCAL_IMAGE_BYTES = 10 * 1024 * 1024
export const SUPPORTED_LOCAL_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])

export function imageReference(asset: ImageAsset) {
  return asset.kind === 'local' ? `asset://${asset.id}` : asset.url ?? ''
}

export function imageUsageCount(documents: DescriptionDocument[], asset: ImageAsset) {
  const reference = imageReference(asset)
  if (!reference) return 0
  return documents.reduce((count, document) => {
    const nexus = document.nexusContent ?? normalizeForNexus(document.content, document.mode)
    return count + Math.max(0, nexus.split(reference).length - 1)
  }, 0)
}

export function validateLocalImage(file: File) {
  if (!SUPPORTED_LOCAL_IMAGE_TYPES.has(file.type)) return 'Use a PNG, JPEG, GIF, or WebP image.'
  if (file.size > MAX_LOCAL_IMAGE_BYTES) return 'Local images must be 10 MB or smaller.'
  return null
}
