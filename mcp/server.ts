#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server'
import { z } from 'zod'
import packageJson from '../package.json'
import {
  buildNexusDescription,
  convertToNexusBBCode,
  NEXUS_AUTHORING_GUIDE,
  validateNexusBBCode,
} from './nexusDescription'
import { NEXUS_PREVIEW_RESOURCE_URI } from './ui/constants'

type PreviewLoader = () => Promise<string> | string
let loadPreviewHtml: PreviewLoader

const server = new McpServer({
  name: 'mod-description-workbench',
  version: packageJson.version,
}, {
  instructions: 'Local, read-only Nexus BBCode authoring utilities. Read nexus://compatibility/authoring-guide before custom authoring, or use the write_nexus_mod_description prompt to receive that guidance with verified facts. Use build for structured mod facts, convert for existing Markdown or BBCode, and validate when the user asks to check supplied BBCode. Build and convert already return validation issues; do not call validate again unless the user explicitly requests a separate check.',
})

const localReadOnlyTool = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const

const previewToolMeta = {
  ui: { resourceUri: NEXUS_PREVIEW_RESOURCE_URI },
  'openai/outputTemplate': NEXUS_PREVIEW_RESOURCE_URI,
  'openai/toolInvocation/invoking': 'Building Nexus preview...',
  'openai/toolInvocation/invoked': 'Nexus preview ready.',
} as const

server.registerResource(
  'nexus-description-preview',
  NEXUS_PREVIEW_RESOURCE_URI,
  {
    title: 'Nexus description preview',
    description: 'Interactive desktop/mobile preview using the same BBCode renderer and fidelity CSS as Mod Description Workbench.',
    mimeType: RESOURCE_MIME_TYPE,
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: RESOURCE_MIME_TYPE,
      text: await loadPreviewHtml(),
      _meta: {
        ui: {
          prefersBorder: true,
          permissions: { clipboardWrite: {} },
        },
        'openai/widgetDescription': 'An interactive Nexus Mods description preview with desktop/mobile widths, compatibility issues, source BBCode, and copy controls.',
      },
    }],
  }),
)

server.registerResource(
  'nexus-authoring-guide',
  'nexus://compatibility/authoring-guide',
  {
    title: 'Nexus MCP authoring and operation guide',
    description: 'How to choose the MCP operation, assemble verified facts, write player-focused copy, and stay within the workbench compatibility rules.',
    mimeType: 'text/markdown',
  },
  async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: NEXUS_AUTHORING_GUIDE }] }),
)

server.registerPrompt(
  'write_nexus_mod_description',
  {
    title: 'Write a native Nexus Mods description',
    description: 'Write paste-ready Nexus BBCode from verified mod facts.',
    argsSchema: {
      modFacts: z.string().min(1).describe('Verified facts from the mod repository, release notes, or author.'),
      audience: z.string().optional().describe('The intended player audience.'),
      tone: z.string().optional().describe('Optional voice guidance, such as concise, technical, or conversational.'),
    },
  },
  ({ modFacts, audience, tone }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `${NEXUS_AUTHORING_GUIDE}\n\n## Verified mod facts\n\n${modFacts}${audience ? `\n\n## Audience\n\n${audience}` : ''}${tone ? `\n\n## Tone\n\n${tone}` : ''}\n\nWrite the complete paste-ready description now. If a material fact is missing, omit that claim. Return only the final BBCode.`,
      },
    }],
  }),
)

server.registerTool(
  'build_nexus_description',
  {
    title: 'Build a Nexus description',
    description: 'Build and validate a clean Nexus BBCode description from structured verified facts. The result already includes validation issues; do not call the validator again.',
    inputSchema: {
      name: z.string().min(1).describe('The verified mod name.'),
      tagline: z.string().min(1).describe('One factual sentence describing the player-facing value.'),
      overview: z.string().min(1).describe('A concise overview containing only verified claims.'),
      features: z.array(z.string()).min(1).describe('Verified player-facing features, one item per entry.'),
      installation: z.array(z.string()).optional().describe('Ordered installation steps, only when known.'),
      usage: z.array(z.string()).optional().describe('Ordered usage steps, only when known.'),
      requirements: z.array(z.string()).optional().describe('Required games, loaders, APIs, or dependencies.'),
      compatibility: z.array(z.string()).optional().describe('Verified supported versions and compatibility notes.'),
      knownIssues: z.array(z.string()).optional().describe('Known limitations or conflicts.'),
      credits: z.array(z.string()).optional().describe('Verified authors, contributors, or dependencies to credit.'),
      presentation: z.enum(['clean', 'editorial']).optional().describe('Use clean for compact utility listings; use editorial for a polished centered hero, separator, stronger hierarchy, and otherwise restrained Nexus-native styling.'),
    },
    outputSchema: {
      bbcode: z.string().describe('Paste-ready Nexus BBCode built from the supplied facts.'),
      issues: z.array(z.string()).describe('Compatibility issues already found in bbcode; an empty array means it validated cleanly.'),
    },
    annotations: localReadOnlyTool,
    _meta: previewToolMeta,
  },
  async (input) => {
    const bbcode = buildNexusDescription(input)
    const output = { bbcode, issues: validateNexusBBCode(bbcode) }
    return { content: [{ type: 'text', text: bbcode }], structuredContent: output }
  },
)

server.registerTool(
  'convert_to_nexus_bbcode',
  {
    title: 'Convert to Nexus BBCode',
    description: 'Convert Markdown through the workbench compatibility boundary, or preserve existing BBCode. The result already includes validation issues.',
    inputSchema: {
      source: z.string().describe('The complete source text to convert or normalize.'),
      format: z.enum(['markdown', 'bbcode']).describe('The format of source. Markdown is converted; BBCode is preserved.'),
    },
    outputSchema: {
      bbcode: z.string().describe('Converted or preserved Nexus BBCode.'),
      issues: z.array(z.string()).describe('Compatibility issues already found in bbcode; an empty array means it validated cleanly.'),
    },
    annotations: localReadOnlyTool,
    _meta: previewToolMeta,
  },
  async ({ source, format }) => {
    const bbcode = convertToNexusBBCode(source, format)
    const output = { bbcode, issues: validateNexusBBCode(bbcode) }
    return { content: [{ type: 'text', text: bbcode }], structuredContent: output }
  },
)

server.registerTool(
  'validate_nexus_bbcode',
  {
    title: 'Validate Nexus BBCode',
    description: 'Check Nexus BBCode against the workbench supported-tag and nesting rules.',
    inputSchema: { bbcode: z.string().describe('The complete Nexus BBCode source to check.') },
    outputSchema: {
      valid: z.boolean().describe('True when no compatibility issues were found.'),
      issues: z.array(z.string()).describe('Every compatibility issue found in the supplied BBCode.'),
    },
    annotations: localReadOnlyTool,
  },
  async ({ bbcode }) => {
    const issues = validateNexusBBCode(bbcode)
    const output = { valid: issues.length === 0, issues }
    return { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }], structuredContent: output }
  },
)

export async function startMcpServer(previewLoader: PreviewLoader) {
  loadPreviewHtml = previewLoader
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
