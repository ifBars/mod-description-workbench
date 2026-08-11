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

## Choose the MCP operation

- Use the \`write_nexus_mod_description\` prompt when you have a free-form packet of verified repository, release-note, or author-supplied facts and want the model to shape the complete listing.
- Use \`build_nexus_description\` when the facts already fit the structured fields and a conservative, repeatable layout is more important than custom prose.
- Use \`convert_to_nexus_bbcode\` for an existing Markdown draft or BBCode source. Conversion changes markup, not facts, and does not make unsupported claims trustworthy.
- Use \`validate_nexus_bbcode\` only to check BBCode supplied by the user or when a separate validation pass is explicitly requested. Build and convert already return compatibility issues.

An empty \`issues\` array means the markup passed the workbench compatibility checks. It does not verify factual accuracy, game compatibility, links, or installation instructions.

## Build the fact packet first

Collect the mod name, one-sentence player-facing value, visible features, how the player accesses or controls them, installation steps, requirements, supported game branch or runtime, multiplayer scope, configuration location and defaults, known issues, credits, and supplied links. Keep unknown fields unknown. Distinguish current behavior from planned work, and current support from compatibility that has not been tested.

## Write for the player deciding whether to install

The short summary should stand on its own: name the concrete change and, when useful, the main interaction point such as a phone app, keybind, shop, menu, or automatic behavior. Put decision-changing facts near the top, especially required loaders or APIs, game branch or Mono/IL2CPP support, single-player or multiplayer scope, save impact, beta status, and important health or safety warnings.

Prefer specific nouns and actions over claims such as “ultimate,” “powerful,” “modern,” or “seamless.” Describe what the player can do and where they do it. Group related features by player task instead of dumping implementation details. Do not imply that download rank, popularity, endorsements, or presentation quality proves that a description caused a mod's success.

## Recommended order

1. Mod name and one-sentence promise.
2. Short overview focused on what changes for the player.
3. Any verified critical requirement, compatibility constraint, or warning that changes the install decision.
4. Features, grouped by player task when the list is long.
5. Installation and how to use it, when known.
6. Configuration, requirements, and compatibility, when known.
7. Known issues, troubleshooting, or limitations, when applicable.
8. Credits, support, and supplied project links.

Use only the sections the facts justify. A small quality-of-life mod may need only an overview, features, installation, and requirements. A framework or dependency may benefit from “Who needs this?”, installation, an FAQ, and a short section for mod authors. Keep changelogs, future plans, legal text, donation requests, and community links after the core player information unless one is materially important to safe use.

For a small configuration-driven mod, keep a distinct Configuration section when the settings are a core part of the player experience. Do not fold every configurable option into Features merely to make the page shorter.

When different audiences need different packages or actions—such as players and server owners, or players and mod developers—give each audience a clearly labelled short section. State which package, runtime, folder, or next step applies to each group, and explicitly warn against the easy wrong choice when the supplied facts identify one.

## Make instructions executable

- Installation steps should name the verified loader, archive action, destination folder or file, and first-launch action when those facts are known.
- Usage should name the verified menu, button, keybind, command, shop, or automatic trigger instead of saying only “enjoy.”
- Configuration should say where settings live, what can be changed, whether a restart is required, and how to reset them only when verified.
- Compatibility should separate game branch/runtime support, multiplayer scope, other-mod compatibility, and known conflicts. Never turn “not reported” into “compatible with everything.”
- Known issues should explain the visible symptom and any verified workaround without burying the core feature pitch.

## Presentation

Use concise paragraphs and scannable lists. Return Nexus BBCode, not Markdown or HTML. Do not include a second copy inside a fenced code block.

Strong real-world Nexus descriptions often use a compact title/tagline, clear section headings, short paragraphs, labelled feature bullets, ordered installation steps, and a restrained closing link or status note. Rich editorial pages may add one separator, one accent colour, or a short story section. Formatting should clarify the information hierarchy, not compensate for vague copy. Avoid repeated ornamental glyph borders, excessive blank lines, emoji on every heading, many competing colours/fonts, duplicate feature summaries, and long lore or update history before the player can understand the mod unless the author explicitly wants that style.

## Final quality gate

Before returning the listing, confirm that:

- the first two sentences explain the player-visible change without hype;
- every requirement, version, branch, path, keybind, command, link, credit, and compatibility claim came from supplied facts;
- critical constraints appear before optional detail;
- installation and usage are actionable rather than generic;
- planned features are clearly separated from current features;
- repeated claims and empty sections are removed; and
- the result contains only paste-ready BBCode.

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
