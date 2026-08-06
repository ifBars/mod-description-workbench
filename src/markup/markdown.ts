import DOMPurify from 'dompurify'
import { marked } from 'marked'

marked.use({ gfm: true, breaks: true })

function spoilers(markdown: string) {
  return markdown.replace(/^:::spoiler(?:\s+([^\n]+))?\n([\s\S]*?)\n:::/gm, (_match, title, content) =>
    `<details class="bbc-spoiler"><summary>${title || 'Spoiler (click to show)'}</summary><div>${marked.parse(content)}</div></details>`)
}

function resolveAssets(value: string, assetUrls: Record<string, string>) {
  return value.replace(/asset:\/\/([\w-]+)/g, (_match, id) => assetUrls[id] ?? '')
}

export function renderMarkdown(markdown: string, assetUrls: Record<string, string> = {}) {
  return DOMPurify.sanitize(marked.parse(spoilers(resolveAssets(markdown, assetUrls))) as string, {
    ADD_TAGS: ['details', 'summary'],
    ADD_ATTR: ['open', 'class'],
  })
}

export function renderRichText(html: string, assetUrls: Record<string, string> = {}) {
  return DOMPurify.sanitize(resolveAssets(html, assetUrls), { ADD_TAGS: ['details', 'summary'], ADD_ATTR: ['open', 'class'] })
}
