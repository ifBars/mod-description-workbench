import { markdownToBBCode } from '../src/markup/convert'
import { bbcodeDiagnostics } from '../src/markup/bbcodeCore'

export interface NexusDescriptionInput {
  name: string
  tagline: string
  overview: string
  features: string[]
  installation?: string[] | undefined
  usage?: string[] | undefined
  requirements?: string[] | undefined
  compatibility?: string[] | undefined
  knownIssues?: string[] | undefined
  credits?: string[] | undefined
  presentation?: 'clean' | 'editorial' | undefined
}

export const NEXUS_AUTHORING_GUIDE = `# Native Nexus Mods description guidance

Write for the current Nexus Mods BBCode renderer. Treat every factual claim as untrusted until it is present in the supplied mod facts. Never invent versions, dependencies, compatibility, features, performance claims, links, installation paths, or credits.

## Recommended order

1. Mod name and one-sentence promise.
2. Short overview focused on what changes for the player.
3. Features.
4. Installation and usage, when known.
5. Requirements and compatibility, when known.
6. Known issues or limitations, when applicable.
7. Credits.

Use concise paragraphs and scannable lists. Return Nexus BBCode, not Markdown or HTML. Do not include a second copy inside a fenced code block.

Strong real-world Nexus descriptions generally use one compact centered title/tagline, clear size-five section headings, short paragraphs, labelled feature bullets, ordered installation steps, and a restrained closing link or status note. Rich editorial pages may add one separator, one accent colour, or a short story section. Avoid repeated ornamental glyph borders, excessive blank lines, many competing colours/fonts, and long lore before the player can understand the mod unless the author explicitly wants that style.

## Confirmed tags

[b], [i], [u], [s], [color], [size], [font], [left], [center], [right], [quote], [code], [list], [list=1], [*], [spoiler], [url], [img], [aimg], [youtube], [video], [soundcloud], [twitter], [heading], and [line].

Prefer [heading] for section headings, [list] with [*] items for feature lists, and plain HTTPS links supplied by the user. Avoid decorative colour/font stacks unless requested. Aligned images, generic video, SoundCloud, and Twitter are recognized but have less complete public-fixture coverage.

The workbench is independent and does not publish to, edit, scrape, or claim affiliation with Nexus Mods. The final BBCode must still be reviewed manually in the Nexus editor before saving.`

function escapeText(value: string) {
  return value.trim().replace(/\[([^\]\r\n]+)\]/g, '($1)').replace(/\[/g, '(')
}

function sectionHeading(title: string, presentation: NexusDescriptionInput['presentation']) {
  return presentation === 'editorial' ? `[heading][size=5]${title}[/size][/heading]` : `[heading]${title}[/heading]`
}

function listSection(title: string, items: string[] | undefined, presentation: NexusDescriptionInput['presentation']) {
  const clean = items?.map(escapeText).filter(Boolean) ?? []
  if (clean.length === 0) return ''
  return `${sectionHeading(title, presentation)}\n[list]\n${clean.map((item) => `[*]${item}`).join('\n')}\n[/list]`
}

function numberedSection(title: string, items: string[] | undefined, presentation: NexusDescriptionInput['presentation']) {
  const clean = items?.map(escapeText).filter(Boolean) ?? []
  if (clean.length === 0) return ''
  return `${sectionHeading(title, presentation)}\n[list=1]\n${clean.map((item) => `[*]${item}`).join('\n')}\n[/list]`
}

export function buildNexusDescription(input: NexusDescriptionInput) {
  const presentation = input.presentation ?? 'clean'
  const introduction = presentation === 'editorial'
    ? `[center][size=6][b]${escapeText(input.name)}[/b][/size]\n[size=4][i]${escapeText(input.tagline)}[/i][/size][/center]\n[line]\n\n${sectionHeading('Overview', presentation)}\n${escapeText(input.overview)}`
    : `[size=5][b]${escapeText(input.name)}[/b][/size]\n\n[i]${escapeText(input.tagline)}[/i]\n\n${escapeText(input.overview)}`
  return [
    introduction,
    listSection('Features', input.features, presentation),
    numberedSection('Installation', input.installation, presentation),
    numberedSection('How to use', input.usage, presentation),
    listSection('Requirements', input.requirements, presentation),
    listSection('Compatibility', input.compatibility, presentation),
    listSection('Known issues', input.knownIssues, presentation),
    listSection('Credits', input.credits, presentation),
  ].filter(Boolean).join('\n\n')
}

export function convertToNexusBBCode(source: string, format: 'markdown' | 'bbcode') {
  return format === 'markdown' ? markdownToBBCode(source) : source
}

export function validateNexusBBCode(bbcode: string) {
  const issues = bbcodeDiagnostics(bbcode)
  if (/asset:\/\//i.test(bbcode)) issues.push('Local asset:// images need public URLs before Nexus export')
  if (/<(?:script|style|iframe|object|embed)\b/i.test(bbcode)) issues.push('Raw scriptable HTML is not valid Nexus BBCode output')
  return [...new Set(issues)]
}
