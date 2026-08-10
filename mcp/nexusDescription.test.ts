import { describe, expect, it } from 'vitest'
import { buildNexusDescription, convertToNexusBBCode, validateNexusBBCode } from './nexusDescription'

describe('Nexus description MCP helpers', () => {
  it('builds clean BBCode from structured facts', () => {
    const bbcode = buildNexusDescription({
      name: 'Better Dealers',
      tagline: 'Clearer dealer management.',
      overview: 'A focused quality-of-life mod.',
      features: ['Faster management', 'Clear status feedback'],
      installation: ['Install the required loader.', 'Place BetterDealers.dll in Mods.'],
      requirements: ['The base game'],
    })

    expect(bbcode).toContain('[heading]Features[/heading]')
    expect(bbcode).toContain('[list=1]')
    expect(validateNexusBBCode(bbcode)).toEqual([])
  })

  it('keeps BBCode-looking structured text readable without leaking HTML entities', () => {
    const bbcode = buildNexusDescription({
      name: '[spoiler]Not a tag',
      tagline: 'Safe',
      overview: 'Safe',
      features: ['Settings live under [SewerGoblinChallenge].', '[b]literal'],
    })

    expect(bbcode).toContain('(spoiler)Not a tag')
    expect(bbcode).toContain('Settings live under (SewerGoblinChallenge).')
    expect(bbcode).not.toContain('&#91;')
    expect(validateNexusBBCode(bbcode)).toEqual([])
  })

  it('builds a restrained editorial hierarchy when requested', () => {
    const bbcode = buildNexusDescription({
      name: 'Signal Relay', tagline: 'Clear status at a glance.', overview: 'A small utility.',
      features: ['Clear channel state', 'Configurable timing'], installation: ['Copy the DLL.'],
      presentation: 'editorial',
    })

    expect(bbcode).toContain('[center][size=6][b]Signal Relay[/b][/size]')
    expect(bbcode).toContain('[heading][size=5]Overview[/size][/heading]')
    expect(bbcode).toContain('[heading][size=5]Features[/size][/heading]')
    expect(validateNexusBBCode(bbcode)).toEqual([])
  })

  it('uses the same Markdown conversion rules as the workbench', () => {
    expect(convertToNexusBBCode('# Title\n\n- One', 'markdown')).toBe('[size=5]Title[/size]\n\n[list]\n[*]One\n[/list]')
  })

  it('reports unsupported tags and unsafe export-only inputs', () => {
    expect(validateNexusBBCode('[table]x[/table][img]asset://one[/img]<script>no</script>')).toEqual([
      'Unknown tag [table]',
      'Local asset:// images need public URLs before Nexus export',
      'Raw scriptable HTML is not valid Nexus BBCode output',
    ])
  })
})
