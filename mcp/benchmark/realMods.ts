import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { scoreRealModDescription, type RealModScore, type RealModStyleProfile } from './realModRubric'

type Variant = 'baseline' | 'guided'

interface RealModScenario {
  id: string
  facts: string
  profile: RealModStyleProfile
}

interface RunResult {
  scenario: string
  variant: Variant
  repetition: number
  valid: boolean
  contaminated: boolean
  contamination: string[]
  score: RealModScore
  durationMs: number
  inputTokens: number
  outputTokens: number
  finalText: string
  exitCode: number
  stderr: string
}

const commonForbidden = [/BepInEx/i, /Nexus API/i, /automatically updates itself/i]

const scenarios: RealModScenario[] = [
  {
    id: 'drug-expansion',
    facts: `Name: Drug Expansion.
Summary: Adds a complete MDMA production chain.
Disco Davey is a new Uptown supplier unlocked through a recommendation from Herbert Bleuball or Tobias Wentworth. He sells three grades of Safrole and Methylamine.
One Safrole variant, one Methylamine, and one Acid make 10 MDMA crystals at a Chemistry Station.
The Manual Tablet Press turns one crystal into one heart-shaped tablet per completed cycle. The player rotates its wheel clockwise through three full turns. Employees can operate it.
Finished tablets use the normal product flow: packaging, consumption, mixing, discovery, Product Manager, and saves. The first tablet discovers MDMA; listing it remains a separate Product Manager action.
The press costs $5,000, unlocks at Baron I, and is sold by both hardware stores.
Install MelonLoader, S1API, and S1MAPI. Put only the matching Drug Expansion DLL in Mods: DrugExpansion_Il2cpp.dll for IL2CPP or DrugExpansion_Mono.dll for Mono.
For best multiplayer support, every player should use the same release and matching dependency builds.`,
    profile: {
      requiredFacts: [/Disco Davey/i, /10 MDMA crystals/i, /three full turns/i, /\$5,000/i, /Baron I/i, /Product Manager/i, /S1API/i, /S1MAPI/i, /DrugExpansion_Il2cpp\.dll/i, /DrugExpansion_Mono\.dll/i],
      forbiddenClaims: [...commonForbidden, /Heroin is (?:included|available|playable)/i],
      leakageMarkers: [/Heroin (?:is )?planned/i, /tablet press may not highlight/i],
      expectedSections: [/What it adds|Overview/i, /MDMA production|Production/i, /Manual Tablet Press/i, /How to start|Getting started|Usage/i, /Basic install|Installation/i, /right file|Runtime|Compatibility/i, /Notes|Multiplayer/i],
      decisionFacts: [/MDMA production/i, /Disco Davey/i, /Chemistry Station/i, /Tablet Press/i],
      wordRange: [150, 620],
    },
  },
  {
    id: 'forklift-and-pallets',
    facts: `Name: Forklift & Pallets.
Summary: Adds a forklift and storage pallets for loading, moving, and placing stored items around properties.
The drivable forklift uses normal Schedule I vehicle controls, front-wheel drive, and rear-wheel steering. It costs $20,000 from Jeremy at Hyland Auto.
Storage Pallets cost $60 from either hardware store and use a native 6x6 storage grid. Stored items remain accessible while carried, and workers can retrieve supplies from placed pallets.
Page Up picks up an aligned pallet and raises the forks. Page Down lowers the forks and releases a pallet near level ground at low speed.
Forklift vehicles and settled pallet placement survive save/load.
Lift keys, lift speed, and maximum lift height are configurable through MelonPreferences under ForkliftandPallets.
Install MelonLoader and the matching S1API release. Put ForkliftandPallets_Il2Cpp.dll or ForkliftandPallets_Mono.dll in Mods for the matching runtime.
The lift state and carried-pallet synchronization are local to the controlling player; multiplayer synchronization is a known limitation.`,
    profile: {
      requiredFacts: [/\$20,000/i, /Jeremy/i, /Hyland Auto/i, /\$60/i, /6x6 storage/i, /Page Up/i, /Page Down/i, /front-wheel drive/i, /rear-wheel steering/i, /ForkliftandPallets_Il2Cpp\.dll/i, /ForkliftandPallets_Mono\.dll/i],
      forbiddenClaims: [...commonForbidden, /fully synchronized multiplayer/i],
      leakageMarkers: [/5 km\/h/i, /S1API 3\.1\.3/i, /multiplayer support will be coming soon/i],
      expectedSections: [/What it is|Overview/i, /Features/i, /Basic install|Installation/i, /Controls/i, /Configuration/i, /Requirements/i, /Multiplayer/i],
      decisionFacts: [/forklift/i, /storage pallets/i, /move|moving/i, /place|placing/i],
      wordRange: [140, 480],
    },
  },
  {
    id: 'dedicated-servers',
    facts: `Name: S1DS - Dedicated Servers.
Summary: Adds authoritative headless dedicated servers to Schedule I for communities that need persistent 24/7 worlds.
Features include save/load, admin and moderation tools, configurable permissions, remote console support, an optional loopback-only web panel, authentication options, and a public API for server and client extension mods.
Supports Mono and IL2CPP. Releases have separate Server and Client packages for each runtime, plus a Docker package.
Server installs use start_server.bat. First boot generates server_config.toml and related files in UserData. Server owners should configure saves, authentication, permissions, and ports before opening the server publicly.
Players joining a server install the matching Client package, not a Server package.
Useful documentation covers quick start, Docker, configuration, authentication, commands, host console, troubleshooting, and the mod API.
The project is not affiliated with or endorsed by the Schedule I developers.`,
    profile: {
      requiredFacts: [/authoritative/i, /headless/i, /24\/7/i, /save(?: and |\/)load/i, /remote console/i, /loopback-only web panel/i, /Mono (?:and|or) IL2CPP/i, /Server and Client/i, /start_server\.bat/i, /server_config\.toml/i, /Docker/i],
      forbiddenClaims: [...commonForbidden, /official server support/i, /cloud-hosted web panel/i],
      leakageMarkers: [/Pterodactyl/i, /config generator/i, /launch the normal Schedule I client before starting/i],
      expectedSections: [/Core features|Features/i, /For server owners/i, /For developers/i, /Basic install|Installation|Quick start/i, /File guide|Packages/i, /right file|Server package|Client package/i, /Useful links|Documentation/i],
      decisionFacts: [/headless/i, /dedicated server/i, /24\/7/i, /server and client/i],
      wordRange: [140, 620],
    },
  },
  {
    id: 's1mapi',
    facts: `Name: S1MAPI - Schedule One Mapping API.
Summary: A mapping and construction library for creating procedural meshes, buildings, interiors, and loading GLTF assets without asset bundles.
Players install it only when another mod declares S1MAPI as a requirement. Mod developers use it as a component-based building and mapping framework.
Features include procedural primitives, building components for walls, floors, roofs, windows, furniture, and lighting, GLTF loading, Unity extension methods, palettes, and update resilience from avoiding Schedule One game types.
The release contains S1MAPI_Il2Cpp.dll for the regular/default Steam branch and S1MAPI_Mono.dll for the alternate branch. The correct DLL goes in UserLibs and loads through MelonLoader.
Developers build against the Mono DLL for both runtimes and can use the documentation, API reference, examples, and building guide.
Requirements: Schedule I and MelonLoader 0.7.0 or newer.`,
    profile: {
      requiredFacts: [/procedural meshes/i, /GLTF/i, /without asset bundles/i, /Players/i, /Mod developers/i, /S1MAPI_Il2Cpp\.dll/i, /regular|default Steam branch/i, /S1MAPI_Mono\.dll/i, /alternate branch/i, /UserLibs/i, /MelonLoader 0\.7\.0/i],
      forbiddenClaims: [...commonForbidden, /put .* in (?:the )?Mods folder/i, /requires S1API/i],
      leakageMarkers: [/icon.*AI-generated/i, /\.NET Framework 4\.7\.2/i],
      expectedSections: [/What is S1MAPI|What S1MAPI does|Overview/i, /Who needs this|Who this is for/i, /Key features|Features/i, /Installation/i, /For Mod Developers|For Developers/i, /Requirements/i, /Documentation|Learn more/i],
      decisionFacts: [/mapping|construction/i, /Players/i, /Mod developers/i, /without asset bundles/i],
      wordRange: [130, 560],
    },
  },
  {
    id: 's1api',
    facts: `Name: S1API - Schedule One Modding API (Community Continued Fork).
Summary: A shared cross-compatibility layer that standardizes common Schedule One modding tasks across Mono and IL2CPP.
Players install it only when one of their mods declares S1API as a dependency. Mod authors use it for common helpers, game integrations, automatic game-branch detection, save/load abstractions, custom content, documentation, and examples.
This maintained community fork preserves the original project's goals and supports the current game.
Install by extracting the release and copying its Plugins and Mods folders into the Schedule I directory. S1API detects the main or alternate branch automatically.
S1API helps authors make a single mod work across both builds, but it does not make arbitrary Mono and IL2CPP mods compatible with each other and cannot cover every modding need.
Support requests should include the game version, branch, runtime, and logs.`,
    profile: {
      requiredFacts: [/cross-compatibility layer/i, /Mono and IL2CPP/i, /Players/i, /Mod authors/i, /dependency/i, /automatic game-branch detection|detects the main or alternate branch/i, /Plugins and Mods folders/i, /does not make arbitrary Mono and IL2CPP mods compatible/i],
      forbiddenClaims: [...commonForbidden, /makes all mods compatible/i, /required for every player/i],
      leakageMarkers: [/KaBooMa/i, /epilepsy|flashing light|photosensitivity/i, /mugshots? (?:are )?generated/i, /1-2 seconds/i],
      expectedSections: [/What S1API does|Overview|About/i, /Who needs this|Who this is for|For Players/i, /Features|What it provides|For Mod Authors/i, /Installation/i, /For Mod Authors|For Developers/i, /FAQ|Limitations|Compatibility Notes/i, /Troubleshooting|Support/i],
      decisionFacts: [/cross-compatibility/i, /Mono and IL2CPP/i, /Players/i, /Mod authors/i],
      wordRange: [120, 560],
    },
  },
  {
    id: 'bigger-lobbies',
    facts: `Name: BiggerLobbies.
Summary: Increases Schedule I lobby capacity from 4 to 20 players.
It dynamically creates UI slots for 20 players and keeps the invite overlay available until the lobby is full.
Supports Mono and IL2CPP.
Install BiggerLobbies_Mono.dll or BiggerLobbies_Il2cpp.dll in Mods for the matching runtime, then launch the game.
Requires MelonLoader and Schedule I.
All players in a lobby should install the mod for best compatibility.`,
    profile: {
      requiredFacts: [/4 to 20 players/i, /UI slots/i, /invite overlay/i, /Mono and IL2CPP/i, /BiggerLobbies_Mono\.dll/i, /BiggerLobbies_Il2cpp\.dll/i, /MelonLoader/i, /all players/i],
      forbiddenClaims: [...commonForbidden, /more than 20 players/i, /server-only/i],
      leakageMarkers: [/Multiplayer\+/i, /More Players/i, /written from scratch/i],
      expectedSections: [/Features/i, /Installation/i, /Requirements/i, /Notes|Compatibility/i],
      decisionFacts: [/4 to 20 players/i, /all players/i],
      wordRange: [70, 230],
    },
  },
  {
    id: 'heated-drying-racks',
    facts: `Name: HeatedDryingRacks.
Summary: Adds heat and cold effects to drying racks.
Above a configurable hot threshold, heat increases drying speed. Below a configurable cold threshold, cold slows or pauses drying.
The game's preferences menu exposes toggles for both effects, configurable bonus and penalty amounts, and the two temperature thresholds.
No installation steps, loader requirement, runtime support statement, multiplayer claim, or external link has been verified for this benchmark.`,
    profile: {
      requiredFacts: [/heat/i, /cold/i, /drying racks/i, /increases drying speed/i, /slows or pauses drying/i, /preferences menu/i, /threshold/i],
      forbiddenClaims: [...commonForbidden, /Installation/i, /MelonLoader/i, /Mono|IL2CPP/i, /multiplayer/i, /Mods folder/i],
      leakageMarkers: [/Enable Heat Effect/i, /Enable Cold Effect/i, /Heat Bonus Minutes/i, /Cold Penalty Minutes/i],
      expectedSections: [/Features/i, /Configuration/i],
      decisionFacts: [/heat/i, /cold/i, /drying racks/i],
      wordRange: [40, 190],
    },
  },
]

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const artifactRoot = resolve(root, '.artifacts', 'mcp-real-mod-benchmark')
const scratchRoot = join(artifactRoot, 'scratch')
const model = process.argv.find((arg) => arg.startsWith('--model='))?.split('=')[1] ?? 'gpt-5.6-luna'
const repetitions = Number(process.argv.find((arg) => arg.startsWith('--repetitions='))?.split('=')[1] ?? 1)
const concurrency = Number(process.argv.find((arg) => arg.startsWith('--concurrency='))?.split('=')[1] ?? 4)
const requestedCase = process.argv.find((arg) => arg.startsWith('--case='))?.split('=')[1]
const selectedScenarios = requestedCase ? scenarios.filter((scenario) => scenario.id === requestedCase) : scenarios
if (selectedScenarios.length === 0) throw new Error(`Unknown real-mod benchmark case: ${requestedCase}`)

function parseEvents(stdout: string) {
  return stdout.split(/\r?\n/).flatMap((line) => {
    if (!line.trim().startsWith('{')) return []
    try { return [JSON.parse(line) as Record<string, unknown>] } catch { return [] }
  })
}

async function readGuideResource() {
  const client = new Client({ name: 'real-mod-guidance-benchmark', version: '1.0.0' })
  await client.connect(new StdioClientTransport({ command: 'bun', args: ['run', 'mcp/server.ts'], cwd: root, stderr: 'pipe' }))
  const resource = await client.readResource({ uri: 'nexus://compatibility/authoring-guide' })
  await client.close()
  const content = resource.contents[0]
  if (!content || !('text' in content)) throw new Error('The authoring guide resource did not return text.')
  return content.text
}

async function runScenario(guide: string, scenario: RealModScenario, variant: Variant, repetition: number): Promise<RunResult> {
  const runDirectory = join(scratchRoot, `${scenario.id}-${variant}-${repetition}`)
  await mkdir(runDirectory, { recursive: true })
  const guidance = variant === 'guided' ? `\n\n## MCP authoring resource\n\n${guide}` : ''
  const prompt = `Write a complete paste-ready Nexus Mods description for the verified mod facts below. Use only the supplied facts. Do not browse, run commands, inspect files, or use outside knowledge. Omit anything that is unknown. Return only Nexus-compatible BBCode with no Markdown fence.${guidance}\n\n## Verified facts\n\n${scenario.facts}`
  const args = [
    'exec', '--ignore-user-config', '--skip-git-repo-check', '--ephemeral', '--json',
    '--sandbox', 'read-only', '-C', runDirectory, '-m', model,
    '-c', 'model_reasoning_effort="medium"',
    prompt,
  ]
  const started = performance.now()
  const { stdout, stderr, exitCode } = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolveRun) => {
    const child = spawn('codex', args, { windowsHide: true })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk })
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk })
    child.stdin.end()
    child.on('error', (error) => resolveRun({ stdout, stderr: `${stderr}\n${error.message}`, exitCode: -1 }))
    child.on('close', (code) => resolveRun({ stdout, stderr, exitCode: code ?? -1 }))
  })
  const events = parseEvents(stdout)
  const completedItems = events.flatMap((event) => {
    if (event.type !== 'item.completed') return []
    return event.item && typeof event.item === 'object' ? [event.item as Record<string, unknown>] : []
  })
  const finalText = completedItems.filter((item) => item.type === 'agent_message').map((item) => String(item.text ?? '')).at(-1) ?? ''
  const externalActionTypes = new Set(['command_execution', 'file_change', 'mcp_tool_call', 'web_search', 'dynamic_tool_call'])
  const externalActions = completedItems
    .map((item) => String(item.type ?? 'unknown'))
    .filter((type) => externalActionTypes.has(type))
  const usageEvent = events.findLast((event) => event.type === 'turn.completed')
  const usage = usageEvent?.usage as Record<string, number> | undefined
  const score = scoreRealModDescription(finalText, scenario.profile)
  const contamination = [
    ...externalActions.map((type) => `used external action: ${type}`),
    ...score.leakageMatches.map((match) => `reproduced withheld reference detail: ${match}`),
  ]
  const contaminated = contamination.length > 0
  return {
    scenario: scenario.id,
    variant,
    repetition,
    valid: exitCode === 0 && finalText.length > 0 && !contaminated,
    contaminated,
    contamination,
    score,
    durationMs: Math.round(performance.now() - started),
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    finalText,
    exitCode,
    stderr,
  }
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
}

function summarize(results: RunResult[]) {
  const variants = (['baseline', 'guided'] as const).map((variant) => {
    const runs = results.filter((result) => result.variant === variant)
    const valid = runs.filter((result) => result.valid)
    return {
      variant,
      runs: runs.length,
      validRuns: valid.length,
      contaminatedRuns: runs.filter((result) => result.contaminated).length,
      meanScore: Number(mean(valid.map((result) => result.score.score)).toFixed(1)),
      passes: valid.filter((result) => result.score.score >= 85).length,
      meanDurationMs: Math.round(mean(valid.map((result) => result.durationMs))),
      meanInputTokens: Math.round(mean(valid.map((result) => result.inputTokens))),
      meanOutputTokens: Math.round(mean(valid.map((result) => result.outputTokens))),
    }
  })
  const pairs = selectedScenarios.map((scenario) => {
    const baseline = results.filter((result) => result.valid && result.scenario === scenario.id && result.variant === 'baseline')
    const guided = results.filter((result) => result.valid && result.scenario === scenario.id && result.variant === 'guided')
    const baselineScore = Number(mean(baseline.map((result) => result.score.score)).toFixed(1))
    const guidedScore = Number(mean(guided.map((result) => result.score.score)).toFixed(1))
    return { scenario: scenario.id, baselineScore, guidedScore, delta: Number((guidedScore - baselineScore).toFixed(1)) }
  })
  return {
    model,
    reasoning: 'medium',
    repetitions,
    cases: selectedScenarios.length,
    isolation: {
      referenceTextPassedToModel: false,
      nexusUrlsPassedToModel: false,
      repositoryPathsPassedToModel: false,
      externalActionsAllowedForScoring: false,
      withheldReferenceDetailsChecked: true,
    },
    variants,
    pairs,
    results,
  }
}

function markdownReport(data: ReturnType<typeof summarize>) {
  const variantRows = data.variants.map((result) => `| ${result.variant} | ${result.validRuns}/${result.runs} | ${result.contaminatedRuns} | ${result.passes}/${result.validRuns} | ${result.meanScore} | ${result.meanDurationMs} | ${result.meanInputTokens} | ${result.meanOutputTokens} |`).join('\n')
  const pairRows = data.pairs.map((pair) => `| ${pair.scenario} | ${pair.baselineScore} | ${pair.guidedScore} | ${pair.delta >= 0 ? '+' : ''}${pair.delta} |`).join('\n')
  const contamination = data.results.filter((result) => result.contaminated).map((result) => `- ${result.scenario}/${result.variant}/r${result.repetition}: ${result.contamination.join('; ')}`).join('\n') || '- None'
  return `# Real Schedule I mod description benchmark\n\nModel: \`${data.model}\` at medium reasoning  \nCases: ${data.cases}  \nRepetitions: ${data.repetitions}\n\nThe paired model receives the same verified fact packet in both variants. The guided variant additionally receives the authoring guide read from the live local MCP resource over stdio. Neither variant receives the published description, Nexus URL or ID, local repository path, reference prose, or scoring profile. Any shell, file, web, or other external action invalidates the run. Distinctive facts deliberately withheld from each prompt act as leakage canaries.\n\n## Aggregate\n\n| Variant | Valid runs | Contaminated | Score >=85 | Mean /100 | Mean latency ms | Mean input tokens | Mean output tokens |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n${variantRows}\n\n## Paired scores\n\n| Case | Baseline | Guided | Delta |\n| --- | ---: | ---: | ---: |\n${pairRows}\n\n## Contamination checks\n\n${contamination}\n`
}

await mkdir(scratchRoot, { recursive: true })
const guide = await readGuideResource()
const jobs = selectedScenarios.flatMap((scenario) => (['baseline', 'guided'] as const).flatMap((variant) =>
  Array.from({ length: repetitions }, (_, index) => ({ scenario, variant, repetition: index + 1 }))))
const results: RunResult[] = []
let cursor = 0
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (cursor < jobs.length) {
    const job = jobs[cursor++]!
    const result = await runScenario(guide, job.scenario, job.variant, job.repetition)
    results.push(result)
    console.log(`${result.valid ? 'VALID' : 'INVALID'} ${job.scenario.id}/${job.variant}/r${job.repetition} score=${result.score.score} ${result.durationMs}ms`)
  }
}))
results.sort((a, b) => `${a.scenario}-${a.variant}-${a.repetition}`.localeCompare(`${b.scenario}-${b.variant}-${b.repetition}`))
const data = summarize(results)
const markdown = markdownReport(data)
await writeFile(join(artifactRoot, 'latest.json'), `${JSON.stringify(data, null, 2)}\n`)
await writeFile(join(artifactRoot, 'latest.md'), markdown)
console.log(markdown)
const guided = data.variants.find((result) => result.variant === 'guided')!
if (results.some((result) => !result.valid) || guided.passes < guided.validRuns) process.exitCode = 1
