export type SectionBuilderId = 'hero' | 'announcement' | 'story' | 'features' | 'installation' | 'requirements' | 'media' | 'status'

export interface SectionBuilderField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'color'
  rows?: number
  placeholder?: string
}

export interface SectionBuilderDefinition {
  id: SectionBuilderId
  name: string
  description: string
  fields: SectionBuilderField[]
  defaults: Record<string, string>
}

const accentField: SectionBuilderField = { key: 'accent', label: 'Accent colour', type: 'color' }

export const SECTION_BUILDERS: SectionBuilderDefinition[] = [
  {
    id: 'hero', name: 'Branded hero', description: 'A centred identity, promise, and short motto.',
    fields: [{ key: 'title', label: 'Mod name', type: 'text' }, { key: 'subtitle', label: 'One-line promise', type: 'text' }, { key: 'motto', label: 'Motto', type: 'text' }, accentField],
    defaults: { title: 'Your Mod Name', subtitle: 'A clear promise about what the mod changes.', motto: 'A memorable line belongs here.', accent: '#d98f40' },
  },
  {
    id: 'announcement', name: 'Announcement', description: 'A high-priority update or read-me callout.',
    fields: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'body', label: 'Message', type: 'textarea', rows: 4 }, accentField],
    defaults: { title: 'READ ME', body: 'Put the most important instruction or recent addition here.', accent: '#ffff00' },
  },
  {
    id: 'story', name: 'Story chapter', description: 'A narrative section with restrained body colour and a divider.',
    fields: [{ key: 'title', label: 'Chapter title', type: 'text' }, { key: 'body', label: 'Story', type: 'textarea', rows: 8 }, accentField],
    defaults: { title: 'Prologue', body: 'Set the scene in a few deliberate paragraphs.\n\nUse story to establish tone before explaining features.', accent: '#0b5394' },
  },
  {
    id: 'features', name: 'Feature section', description: 'A heading, concise setup, and scannable labelled list.',
    fields: [{ key: 'title', label: 'Heading', type: 'text' }, { key: 'intro', label: 'Introduction', type: 'textarea', rows: 3 }, { key: 'items', label: 'Features', type: 'textarea', rows: 7, placeholder: 'Phone app: Manage your empire\nShared market: Trade with other players' }, accentField],
    defaults: { title: 'Features', intro: 'Lead with the experience, then let the list carry the details.', items: 'Core feature: Explain the strongest benefit\nIntegrated workflow: Explain how it fits the game\nReliable defaults: Explain why setup stays simple', accent: '#3d85c6' },
  },
  {
    id: 'installation', name: 'Installation tree', description: 'A readable folder tree for mod and dependency placement.',
    fields: [{ key: 'title', label: 'Heading', type: 'text' }, { key: 'intro', label: 'Instruction', type: 'textarea', rows: 3 }, { key: 'tree', label: 'Folder tree', type: 'textarea', rows: 8 }],
    defaults: { title: 'Installation', intro: 'Place each file in the matching folder and install the listed dependencies.', tree: 'Game folder\n|-- Mods\n|   |-- YourMod.dll (this mod)\n|   `-- Dependency.dll\n`-- Plugins\n    `-- Loader.dll' },
  },
  {
    id: 'requirements', name: 'Requirements', description: 'A linked dependency list with plain-text fallback.',
    fields: [{ key: 'title', label: 'Heading', type: 'text' }, { key: 'items', label: 'Requirements', type: 'textarea', rows: 7, placeholder: 'Dependency | https://example.com\nGame version' }, accentField],
    defaults: { title: 'Requirements', items: 'Required API | https://example.com/api\nMod loader | https://example.com/loader\nBase game', accent: '#6aa84f' },
  },
  {
    id: 'media', name: 'Video callout', description: 'A centred instruction and Nexus-sized YouTube embed.',
    fields: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'body', label: 'Instruction', type: 'textarea', rows: 3 }, { key: 'video', label: 'YouTube ID or URL', type: 'text', placeholder: 'dQw4w9WgXcQ' }, accentField],
    defaults: { title: 'Setup video', body: 'If you need help, watch the installation walkthrough.', video: '', accent: '#ffff00' },
  },
  {
    id: 'status', name: 'Status footer', description: 'A prominent release, beta, or work-in-progress notice.',
    fields: [{ key: 'title', label: 'Status', type: 'text' }, { key: 'body', label: 'Detail', type: 'textarea', rows: 3 }, accentField],
    defaults: { title: 'WORK IN PROGRESS', body: 'Features and compatibility may change between releases.', accent: '#00ff00' },
  },
]

function value(values: Record<string, string>, key: string) { return (values[key] ?? '').trim() }
function text(input: string) { return input.replace(/\[/g, '&#91;') }
function multiline(input: string) { return input.split(/\r?\n/).map(text).join('\n').trim() }
function colour(input: string, fallback: string) { return /^#[0-9a-f]{6}$/i.test(input) ? input : fallback }
function lines(input: string) { return input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) }

function featureItem(item: string, accent: string) {
  const separator = item.indexOf(':')
  if (separator < 1) return `[*][color=#d8d8d8]${text(item)}[/color][/*]`
  const label = text(item.slice(0, separator).trim())
  const detail = text(item.slice(separator + 1).trim())
  return `[*][b][color=${accent}]${label}[/color][/b]: [color=#d8d8d8]${detail}[/color][/*]`
}

function requirementItem(item: string, accent: string) {
  const [label, candidateUrl] = item.split('|', 2).map((part) => part.trim())
  const safeLabel = text(label ?? '')
  return candidateUrl && /^https:\/\/[^\s[\]]+$/i.test(candidateUrl)
    ? `[*][url=${candidateUrl}][color=${accent}]${safeLabel}[/color][/url][/*]`
    : `[*]${safeLabel}[/*]`
}

function youtubeId(input: string) {
  const direct = input.match(/^[\w-]{6,20}$/)?.[0]
  if (direct) return direct
  return input.match(/(?:youtu\.be\/|[?&]v=)([\w-]{6,20})/i)?.[1] ?? ''
}

export function sectionBuilderDefinition(id: SectionBuilderId) { return SECTION_BUILDERS.find((builder) => builder.id === id) ?? SECTION_BUILDERS[0]! }

export function renderSectionBuilder(id: SectionBuilderId, values: Record<string, string>) {
  const accent = colour(value(values, 'accent'), '#d98f40')
  const title = text(value(values, 'title'))
  const body = multiline(value(values, 'body'))

  switch (id) {
    case 'hero': return `[center][font=Arial Black][color=#444444][size=2]◆ ---------------- ◆[/size][/color]\n[color=${accent}][size=6][b]${title}[/b][/size][/color]\n[color=#d8d8d8][size=4]${text(value(values, 'subtitle'))}[/size][/color]\n[color=#b6b6b6][size=2][b]“${text(value(values, 'motto'))}”[/b][/size][/color]\n[color=#444444][size=2]◆ ---------------- ◆[/size][/color][/font][/center]\n[line]`
    case 'announcement': return `[center][color=${accent}][size=5][b][!] ${title} [!][/b][/size][/color]\n[color=#e69138][size=4]${body}[/size][/color][/center]`
    case 'story': return `[color=${accent}][size=5][b][u]${title}[/u][/b][/size][/color]\n[color=#999999]${body}[/color]\n[line]`
    case 'features': {
      const items = lines(value(values, 'items')).map((item) => featureItem(item, accent)).join('\n')
      return `[heading][size=5]${title}[/size][/heading]\n[color=#d8d8d8]${multiline(value(values, 'intro'))}[/color]\n\n[list]\n${items}\n[/list]`
    }
    case 'installation': return `[size=5][b]${title}[/b][/size]\n${multiline(value(values, 'intro'))}\n\n[font=Courier New]${multiline(value(values, 'tree'))}[/font]`
    case 'requirements': {
      const items = lines(value(values, 'items')).map((item) => requirementItem(item, accent)).join('\n')
      return `[size=5]${title}[/size]\n[list]\n${items}\n[/list]`
    }
    case 'media': {
      const id = youtubeId(value(values, 'video'))
      return `[center][color=${accent}][size=5][b]${title}[/b][/size][/color]\n[color=#e69138][size=4]${body}[/size][/color]${id ? `\n[youtube]${id}[/youtube]` : ''}[/center]`
    }
    case 'status': return `[center][color=${accent}][size=6][b][ ${title} ][/b][/size][/color]\n[color=#d8d8d8]${body}[/color][/center]`
  }
}
