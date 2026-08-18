import previewHtmlPath from './ui/dist/nexus-preview.html' with { type: 'file' }
import { readFile } from 'node:fs/promises'
import { startMcpServer } from './server.ts'

await startMcpServer(() => readFile(previewHtmlPath, 'utf8'))
