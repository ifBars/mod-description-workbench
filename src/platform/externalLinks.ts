import type { MouseEvent } from 'react'
import { platformRuntime } from './runtime'

export function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

type ExternalUrlOpener = (url: string) => Promise<void>

async function defaultExternalUrlOpener(url: string) {
  await (await import('@tauri-apps/plugin-opener')).openUrl(url)
}

export async function openExternalUrl(value: string, open: ExternalUrlOpener = defaultExternalUrlOpener) {
  const url = safeExternalUrl(value)
  if (!url) return false
  await open(url)
  return true
}

export async function routeExternalLinkForRuntime(event: MouseEvent<HTMLAnchorElement>, runtime: ReturnType<typeof platformRuntime>, open?: ExternalUrlOpener) {
  if (runtime !== 'tauri') return false
  event.preventDefault()
  return openExternalUrl(event.currentTarget.href, open)
}

export function routeExternalLink(event: MouseEvent<HTMLAnchorElement>) {
  void routeExternalLinkForRuntime(event, platformRuntime()).catch(() => undefined)
}
