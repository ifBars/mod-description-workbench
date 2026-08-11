import { describe, expect, it } from 'vitest'
import { scoreRealModDescription, type RealModStyleProfile } from './realModRubric'

const profile: RealModStyleProfile = {
  requiredFacts: [/20 players/i, /Mono and IL2CPP/i, /BiggerLobbies_Mono\.dll/i],
  forbiddenClaims: [/BepInEx/i, /64 players/i],
  leakageMarkers: [/Multiplayer\+/i],
  expectedSections: [/Features/i, /Installation/i, /Requirements/i],
  decisionFacts: [/20 players/i, /Mono and IL2CPP/i],
  wordRange: [30, 180],
}

describe('real mod description rubric', () => {
  it('rewards grounded, concise, decision-first copy', () => {
    const bbcode = `[size=5][b]BiggerLobbies[/b][/size]

Increases lobbies to 20 players with Mono and IL2CPP support.

[heading]Features[/heading]
[list][*]Creates slots for 20 players.[*]Keeps the invite overlay available until the lobby is full.[/list]

[heading]Installation[/heading]
[list=1][*]Put BiggerLobbies_Mono.dll in Mods.[/list]

[heading]Requirements[/heading]
[list][*]MelonLoader[/list]`
    const result = scoreRealModDescription(bbcode, profile)

    expect(result.score).toBe(100)
    expect(result.missedFacts).toEqual([])
    expect(result.unsupportedClaims).toEqual([])
    expect(result.leakageMatches).toEqual([])
  })

  it('reports omissions, unsupported claims, late constraints, and invalid wrappers', () => {
    const result = scoreRealModDescription('```bbcode\n# BiggerLobbies\nThe ultimate mod for 64 players with BepInEx, unlike Multiplayer+.\n```', profile)

    expect(result.score).toBeLessThan(35)
    expect(result.missedFacts).toContain('20 players')
    expect(result.unsupportedClaims).toEqual(expect.arrayContaining(['BepInEx', '64 players']))
    expect(result.leakageMatches).toEqual(['Multiplayer\\+'])
    expect(result.compatibilityIssues).toEqual(expect.arrayContaining([
      'Output contains a Markdown code fence',
      'Output contains Markdown headings',
    ]))
  })
})
