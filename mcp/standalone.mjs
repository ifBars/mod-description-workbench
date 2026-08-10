import previewHtmlPath from './ui/dist/nexus-preview.html' with { type: 'file' }
import process from 'node:process'

process.env.NEXUS_DESCRIPTION_MCP_PREVIEW_PATH = previewHtmlPath
await import('./server.ts')
