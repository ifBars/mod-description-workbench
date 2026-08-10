import { validateNexusBBCode } from '../nexusDescription'

export interface PresentationScore {
  score: number
  checks: Record<string, number>
}

function count(source: string, pattern: RegExp) {
  return source.match(pattern)?.length ?? 0
}

export function scoreNexusPresentation(bbcode: string): PresentationScore {
  const lower = bbcode.toLowerCase()
  const headingCount = count(lower, /\[heading\]\[size=5\]/g)
  const bulletCount = count(lower, /\[\*\]/g)
  const requiredSections = ['overview', 'features', 'installation', 'how to use', 'requirements', 'compatibility', 'known issues', 'credits']
  const presentSections = requiredSections.filter((section) => lower.includes(`>${section}<`) || lower.includes(`]${section}[`)).length
  const colorCount = count(lower, /\[color=/g)
  const fontCount = count(lower, /\[font=/g)
  const checks = {
    compatibility: validateNexusBBCode(bbcode).length === 0 ? 20 : 0,
    hero: /\[center\]\[size=6\]\[b\].+?\[\/b\]\[\/size\][\s\S]*?\[size=4\]\[i\].+?\[\/i\]\[\/size\]\[\/center\]/i.test(bbcode) ? 15 : 0,
    hierarchy: Math.min(20, headingCount * 3),
    scannability: (lower.includes('[list]') ? 7 : 0) + (lower.includes('[list=1]') ? 7 : 0) + Math.min(6, bulletCount),
    completeness: Math.round((presentSections / requiredSections.length) * 10),
    whitespace: /\n{4,}/.test(bbcode) || /[^\w\s[\]]{12,}/.test(bbcode) ? 0 : 10,
    restraint: colorCount <= 1 && fontCount <= 1 ? 5 : colorCount <= 2 && fontCount <= 1 ? 3 : 0,
  }
  return { score: Object.values(checks).reduce((sum, value) => sum + value, 0), checks }
}
