import { describe, expect, it } from 'vitest'
import { buildNexusDescription } from '../nexusDescription'
import { scoreNexusPresentation } from './presentationRubric'

const completeInput = {
  name: 'Signal Relay',
  tagline: 'Clear radio status at a glance.',
  overview: 'A focused quality-of-life mod.',
  features: ['Shows the active channel', 'Coalesces repeated notices'],
  installation: ['Install the loader', 'Copy the DLL'],
  usage: ['Launch the game', 'Change channels normally'],
  requirements: ['The base game', 'A supported loader'],
  compatibility: ['The current public build'],
  knownIssues: ['Notices can overlap'],
  credits: ['Signal Relay contributors'],
} as const

describe('Nexus presentation rubric', () => {
  it('rewards the restrained editorial hierarchy', () => {
    const bbcode = buildNexusDescription({
      ...completeInput,
      features: [...completeInput.features], installation: [...completeInput.installation], usage: [...completeInput.usage],
      requirements: [...completeInput.requirements], compatibility: [...completeInput.compatibility],
      knownIssues: [...completeInput.knownIssues], credits: [...completeInput.credits], presentation: 'editorial',
    })

    expect(scoreNexusPresentation(bbcode).score).toBeGreaterThanOrEqual(90)
  })

  it('scores an undecorated partial description lower', () => {
    expect(scoreNexusPresentation('[b]Signal Relay[/b]\nA utility.').score).toBeLessThan(50)
  })
})
