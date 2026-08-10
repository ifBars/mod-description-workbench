#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import packageJson from '../../package.json'
import {
  buildNexusDescription,
  convertToNexusBBCode,
  validateNexusBBCode,
} from '../nexusDescription'

const consolidatedInput = z.object({
  action: z.enum(['build', 'convert', 'validate']).describe('Use build for structured facts, convert for source text, or validate for supplied BBCode.'),
  name: z.string().min(1).optional().describe('The verified mod name.'),
  tagline: z.string().min(1).optional().describe('One factual sentence describing the player-facing value.'),
  overview: z.string().min(1).optional().describe('A concise overview containing only verified claims.'),
  features: z.array(z.string()).min(1).optional().describe('Verified player-facing features, one item per entry.'),
  installation: z.array(z.string()).optional().describe('Ordered installation steps, only when known.'),
  usage: z.array(z.string()).optional().describe('Ordered usage steps, only when known.'),
  requirements: z.array(z.string()).optional().describe('Required games, loaders, APIs, or dependencies.'),
  compatibility: z.array(z.string()).optional().describe('Verified supported versions and compatibility notes.'),
  knownIssues: z.array(z.string()).optional().describe('Known limitations or conflicts.'),
  credits: z.array(z.string()).optional().describe('Verified authors, contributors, or dependencies to credit.'),
  presentation: z.enum(['clean', 'editorial']).optional().describe('Build only: clean is compact; editorial adds a polished centered hero and stronger hierarchy.'),
  source: z.string().optional().describe('The complete source text to convert or normalize.'),
  format: z.enum(['markdown', 'bbcode']).optional().describe('The format of source. Markdown is converted; BBCode is preserved.'),
  bbcode: z.string().optional().describe('The complete Nexus BBCode source to check.'),
})

const buildActionInput = consolidatedInput.extend({
  action: z.literal('build'), name: z.string().min(1), tagline: z.string().min(1), overview: z.string().min(1), features: z.array(z.string()).min(1),
})
const convertActionInput = consolidatedInput.extend({ action: z.literal('convert'), source: z.string(), format: z.enum(['markdown', 'bbcode']) })
const validateActionInput = consolidatedInput.extend({ action: z.literal('validate'), bbcode: z.string() })

const server = new McpServer({
  name: 'mod-description-workbench-consolidated-benchmark',
  version: packageJson.version,
}, {
  instructions: 'Local, read-only Nexus BBCode utility. Call nexus_description with action build for structured mod facts, convert for existing Markdown or BBCode, or validate to check supplied BBCode. Build and convert already return validation issues.',
})

server.registerTool(
  'nexus_description',
  {
    title: 'Nexus description operations',
    description: 'Build, convert, or validate Nexus BBCode. Choose exactly one action. Build and convert results already include validation issues.',
    inputSchema: {
      action: consolidatedInput.shape.action,
      name: consolidatedInput.shape.name.describe('Build only: the verified mod name.'),
      tagline: consolidatedInput.shape.tagline.describe('Build only: one factual sentence describing player-facing value.'),
      overview: consolidatedInput.shape.overview.describe('Build only: a concise overview containing only verified claims.'),
      features: consolidatedInput.shape.features.describe('Build only: verified player-facing features.'),
      installation: consolidatedInput.shape.installation,
      usage: consolidatedInput.shape.usage,
      requirements: consolidatedInput.shape.requirements,
      compatibility: consolidatedInput.shape.compatibility,
      knownIssues: consolidatedInput.shape.knownIssues,
      credits: consolidatedInput.shape.credits,
      presentation: consolidatedInput.shape.presentation,
      source: consolidatedInput.shape.source.describe('Convert only: the complete source text.'),
      format: consolidatedInput.shape.format.describe('Convert only: the source format.'),
      bbcode: consolidatedInput.shape.bbcode.describe('Validate only: the complete Nexus BBCode source.'),
    },
    outputSchema: {
      action: z.enum(['build', 'convert', 'validate']),
      bbcode: z.string().optional(),
      valid: z.boolean().optional(),
      issues: z.array(z.string()).describe('Compatibility issues already found; an empty array means the output validated cleanly.'),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (rawInput) => {
    const action = consolidatedInput.shape.action.parse(rawInput.action)
    if (action === 'validate') {
      const input = validateActionInput.parse(rawInput)
      const issues = validateNexusBBCode(input.bbcode)
      const output = { action: input.action, valid: issues.length === 0, issues }
      return { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }], structuredContent: output }
    }

    const input = action === 'convert' ? convertActionInput.parse(rawInput) : buildActionInput.parse(rawInput)
    const bbcode = input.action === 'convert' ? convertToNexusBBCode(input.source, input.format) : buildNexusDescription(input)
    const output = { action, bbcode, issues: validateNexusBBCode(bbcode) }
    return { content: [{ type: 'text', text: bbcode }], structuredContent: output }
  },
)

await server.connect(new StdioServerTransport())
