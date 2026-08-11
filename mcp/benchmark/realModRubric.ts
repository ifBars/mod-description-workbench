import { validateNexusBBCode } from '../nexusDescription'

export interface RealModStyleProfile {
  requiredFacts: RegExp[]
  forbiddenClaims: RegExp[]
  leakageMarkers?: RegExp[]
  expectedSections: RegExp[]
  decisionFacts: RegExp[]
  wordRange: readonly [number, number]
}

export interface RealModScore {
  score: number
  checks: {
    factualRetention: number
    grounding: number
    sectionFit: number
    decisionPriority: number
    compatibility: number
    restraint: number
  }
  missedFacts: string[]
  unsupportedClaims: string[]
  leakageMatches: string[]
  missedSections: string[]
  lateDecisionFacts: string[]
  compatibilityIssues: string[]
  wordCount: number
}

function label(pattern: RegExp) {
  return pattern.source.replaceAll('\\b', '').replaceAll('\\s+', ' ').replaceAll('\\.', '.')
}

function matching(patterns: RegExp[], source: string) {
  return patterns.filter((pattern) => pattern.test(source))
}

function points(available: number, hits: number, total: number) {
  return total === 0 ? available : Math.round(available * hits / total)
}

export function stripBBCode(source: string) {
  return source
    .replace(/\[\/?[^\]\r\n]+\]/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function scoreRealModDescription(bbcode: string, profile: RealModStyleProfile): RealModScore {
  const plain = stripBBCode(bbcode)
  const factHits = matching(profile.requiredFacts, plain)
  const forbiddenHits = matching(profile.forbiddenClaims, plain)
  const leakageHits = matching(profile.leakageMarkers ?? [], plain)
  const sectionHits = matching(profile.expectedSections, plain)
  const decisionBoundary = Math.max(240, Math.round(plain.length * 0.45))
  const earlyDecisionHits = profile.decisionFacts.filter((pattern) => {
    const index = plain.search(pattern)
    return index >= 0 && index <= decisionBoundary
  })
  const parserIssues = validateNexusBBCode(bbcode)
  const wrapperIssues = [
    /```/.test(bbcode) ? 'Output contains a Markdown code fence' : '',
    /^\s*#{1,6}\s/m.test(bbcode) ? 'Output contains Markdown headings' : '',
    /<(?:script|style|iframe|object|embed)\b/i.test(bbcode) ? 'Output contains raw scriptable HTML' : '',
  ].filter(Boolean)
  const compatibilityIssues = [...parserIssues, ...wrapperIssues]
  const wordCount = plain ? plain.split(/\s+/).length : 0
  const [minimumWords, maximumWords] = profile.wordRange
  const hypeFree = !/\b(?:ultimate|revolutionary|game-changing|must-have|best-in-class|seamless|powerful)\b/i.test(plain)
  const ornamentFree = !/[✨🚀🔥💥🎉]{2,}|[^\w\s[\]]{12,}/u.test(bbcode)
  const lengthFit = wordCount >= minimumWords && wordCount <= maximumWords

  const checks = {
    factualRetention: points(40, factHits.length, profile.requiredFacts.length),
    grounding: Math.max(0, 15 - forbiddenHits.length * 5),
    sectionFit: points(15, sectionHits.length, profile.expectedSections.length),
    decisionPriority: points(10, earlyDecisionHits.length, profile.decisionFacts.length),
    compatibility: compatibilityIssues.length === 0 ? 10 : 0,
    restraint: (hypeFree ? 4 : 0) + (ornamentFree ? 3 : 0) + (lengthFit ? 3 : 0),
  }

  return {
    score: Object.values(checks).reduce((sum, value) => sum + value, 0),
    checks,
    missedFacts: profile.requiredFacts.filter((pattern) => !factHits.includes(pattern)).map(label),
    unsupportedClaims: forbiddenHits.map(label),
    leakageMatches: leakageHits.map(label),
    missedSections: profile.expectedSections.filter((pattern) => !sectionHits.includes(pattern)).map(label),
    lateDecisionFacts: profile.decisionFacts.filter((pattern) => !earlyDecisionHits.includes(pattern)).map(label),
    compatibilityIssues,
    wordCount,
  }
}
