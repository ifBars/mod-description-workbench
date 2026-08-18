#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startMcpServer } from './server'

const serverDirectory = dirname(fileURLToPath(import.meta.url))
const previewHtmlPath = process.env.NEXUS_DESCRIPTION_MCP_PREVIEW_PATH
  ?? resolve(serverDirectory, 'ui', 'dist', 'nexus-preview.html')

await startMcpServer(() => readFile(previewHtmlPath, 'utf8'))
