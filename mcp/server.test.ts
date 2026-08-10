import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { NEXUS_PREVIEW_RESOURCE_URI } from './ui/constants'

const client = new Client({ name: 'mod-description-workbench-test', version: '1.0.0' })

describe('Nexus description MCP server', () => {
  beforeAll(async () => {
    await client.connect(new StdioClientTransport({
      command: 'bun',
      args: ['run', 'mcp/start.ts'],
      cwd: process.cwd(),
      stderr: 'pipe',
    }))
  }, 15_000)

  afterAll(async () => {
    await client.close()
  })

  it('publishes its tools, prompt, and compatibility resource', async () => {
    const [tools, prompts, resources] = await Promise.all([
      client.listTools(),
      client.listPrompts(),
      client.listResources(),
    ])

    expect(tools.tools.map((tool) => tool.name)).toEqual([
      'build_nexus_description',
      'convert_to_nexus_bbcode',
      'validate_nexus_bbcode',
    ])
    expect(tools.tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true)
    expect(tools.tools.every((tool) => tool.annotations?.destructiveHint === false)).toBe(true)
    expect(tools.tools.every((tool) => tool.annotations?.openWorldHint === false)).toBe(true)
    expect(tools.tools.find((tool) => tool.name === 'build_nexus_description')?._meta?.ui).toEqual({ resourceUri: NEXUS_PREVIEW_RESOURCE_URI })
    expect(tools.tools.find((tool) => tool.name === 'convert_to_nexus_bbcode')?._meta?.ui).toEqual({ resourceUri: NEXUS_PREVIEW_RESOURCE_URI })
    expect(tools.tools.find((tool) => tool.name === 'validate_nexus_bbcode')?._meta?.ui).toBeUndefined()
    expect(prompts.prompts.map((prompt) => prompt.name)).toContain('write_nexus_mod_description')
    expect(resources.resources.map((resource) => resource.uri)).toContain('nexus://compatibility/authoring-guide')
    expect(resources.resources.map((resource) => resource.uri)).toContain(NEXUS_PREVIEW_RESOURCE_URI)
  })

  it('serves a self-contained MCP App preview resource', async () => {
    const resource = await client.readResource({ uri: NEXUS_PREVIEW_RESOURCE_URI })
    const content = resource.contents[0]
    expect(content).toMatchObject({ uri: NEXUS_PREVIEW_RESOURCE_URI, mimeType: 'text/html;profile=mcp-app' })
    const html = content && 'text' in content ? content.text : ''
    expect(html).toContain('Nexus description preview')
    expect(html).toContain('ui/notifications/tool-result')
    expect(html).toContain('.nexus-surface')
    expect(html).toContain('data:font/woff2;base64,')
    expect(html).not.toContain('/*__MCP_APP_')
    const document = new DOMParser().parseFromString(html, 'text/html')
    expect(document.querySelector('script[src]')).toBeNull()
    expect(document.querySelector('link[rel="stylesheet"]')).toBeNull()
    expect(document.querySelectorAll('body > *')).toHaveLength(2)
    expect([...document.body.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())).toHaveLength(0)
  })

  it('calls the validator over the stdio protocol', async () => {
    const result = await client.callTool({
      name: 'validate_nexus_bbcode',
      arguments: { bbcode: '[heading]Features[/heading]\n[list][*]One[/list]' },
    })

    expect(result.structuredContent).toEqual({ valid: true, issues: [] })
  })

  it('returns readable structured text instead of HTML entity escapes', async () => {
    const result = await client.callTool({
      name: 'build_nexus_description',
      arguments: {
        name: 'Goblin on the Loose',
        tagline: 'A focused challenge.',
        overview: 'Settings live under [SewerGoblinChallenge].',
        features: ['Configurable pursuit speed'],
      },
    })
    const output = result.structuredContent as { bbcode?: string } | undefined

    expect(output?.bbcode).toContain('Settings live under (SewerGoblinChallenge).')
    expect(output?.bbcode).not.toContain('&#91;')
  })

  it('returns the authoring resource and a fact-bounded prompt', async () => {
    const [resource, prompt] = await Promise.all([
      client.readResource({ uri: 'nexus://compatibility/authoring-guide' }),
      client.getPrompt({ name: 'write_nexus_mod_description', arguments: { modFacts: 'Name: Signal Relay' } }),
    ])

    expect(resource.contents[0]).toMatchObject({ mimeType: 'text/markdown' })
    expect('text' in resource.contents[0]! ? resource.contents[0].text : '').toContain('Never invent versions')
    expect(prompt.messages[0]?.content).toMatchObject({ type: 'text' })
  })

  it('rejects invalid input without terminating the server', async () => {
    const invalid = await client.callTool({ name: 'build_nexus_description', arguments: { name: 'Incomplete' } })
    expect(invalid.isError).toBe(true)

    const followup = await client.callTool({ name: 'validate_nexus_bbcode', arguments: { bbcode: '[b]Still alive[/b]' } })
    expect(followup.structuredContent).toEqual({ valid: true, issues: [] })
  })

  it('handles concurrent read-only calls', async () => {
    const results = await Promise.all(Array.from({ length: 6 }, (_, index) => client.callTool({
      name: 'validate_nexus_bbcode',
      arguments: { bbcode: `[b]Concurrent ${index}[/b]` },
    })))

    expect(results.every((result) => (result.structuredContent as { valid?: boolean } | undefined)?.valid === true)).toBe(true)
  })
})
