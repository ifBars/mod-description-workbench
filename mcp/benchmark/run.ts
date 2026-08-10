import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { markdownToBBCode } from '../../src/markup/convert'
import { scoreNexusPresentation } from './presentationRubric'

type Variant = 'split' | 'consolidated'
type Effort = 'medium' | 'high'

interface Scenario {
  id: string
  prompt: string
  operation: 'build' | 'convert' | 'validate'
  verify: (call: McpCall, finalText: string) => string[]
  presentationScore?: (call: McpCall) => number
}

interface McpCall {
  tool: string
  arguments: Record<string, unknown>
  result?: { structured_content?: Record<string, unknown> } | null
  error?: { message?: string } | null
  status: string
}

interface RunResult {
  variant: Variant
  effort: Effort
  scenario: string
  repetition: number
  passed: boolean
  taskPassed: boolean
  cleanRun: boolean
  failures: string[]
  taskFailures: string[]
  integrationFailures: string[]
  durationMs: number
  calls: McpCall[]
  finalText: string
  usage?: Record<string, number>
  exitCode: number
  stderr: string
  presentationScore?: number
}

const expectedMarkdown = '# Signal Relay\n\nA small utility.\n\n- Fast setup\n- Clear feedback'
const expectedBBCode = markdownToBBCode(expectedMarkdown)

const scenarios: Scenario[] = [
  {
    id: 'route-valid-validation',
    operation: 'validate',
    prompt: 'Use the Nexus description MCP to validate this exact BBCode: [b]Safe[/b]. Return only valid or invalid.',
    verify: (call, finalText) => {
      const output = call.result?.structured_content
      return [
        output?.valid === true ? '' : 'validator did not return valid=true',
        /^valid[.!]?$/i.test(finalText.trim()) ? '' : 'final answer did not report valid',
      ].filter(Boolean)
    },
  },
  {
    id: 'route-invalid-validation',
    operation: 'validate',
    prompt: 'Use the Nexus description MCP to validate this exact BBCode: [table]x[/table][img]asset://hero[/img]. Briefly report every issue.',
    verify: (call, finalText) => {
      const output = call.result?.structured_content
      const issues = Array.isArray(output?.issues) ? output.issues.map(String) : []
      return [
        issues.includes('Unknown tag [table]') ? '' : 'missing unknown table issue',
        issues.includes('Local asset:// images need public URLs before Nexus export') ? '' : 'missing local image issue',
        /table/i.test(finalText) && /public url|local/i.test(finalText) ? '' : 'final answer omitted an issue',
      ].filter(Boolean)
    },
  },
  {
    id: 'route-markdown-conversion',
    operation: 'convert',
    prompt: `Use the Nexus description MCP to convert this Markdown to Nexus BBCode. Return only the converted BBCode, without a code fence.\n\n${expectedMarkdown}`,
    verify: (call, finalText) => {
      const output = call.result?.structured_content
      return [
        output?.bbcode === expectedBBCode ? '' : 'tool result did not match the workbench converter',
        finalText.trim() === expectedBBCode ? '' : 'final answer changed or wrapped the converted BBCode',
      ].filter(Boolean)
    },
  },
  {
    id: 'route-structured-build',
    operation: 'build',
    prompt: 'Use the Nexus description MCP to build a complete description from only these verified facts. Name: Signal Relay. Tagline: Cleaner radio status at a glance. Overview: A small quality-of-life mod for clearer radio feedback. Features: clearer active-channel status; configurable notification duration. Installation: place SignalRelay.dll in the Mods folder. Requirements: base game; supported mod loader. Known issue: notification timing can overlap during rapid channel changes. Return only the BBCode.',
    verify: (call, finalText) => {
      const output = call.result?.structured_content
      const bbcode = String(output?.bbcode ?? '')
      const normalized = bbcode.toLowerCase()
      const required = ['signal relay', 'cleaner radio status at a glance.', 'clearer active-channel status', 'signalrelay.dll', 'notification timing can overlap']
      const invented = ['BepInEx', 'MelonLoader', 'Nexus API', 'version 1.']
      return [
        required.every((text) => normalized.includes(text)) ? '' : 'tool result omitted a verified fact',
        invented.every((text) => !bbcode.includes(text)) ? '' : 'tool result invented an unsupported detail',
        Array.isArray(output?.issues) && output.issues.length === 0 ? '' : 'built BBCode did not validate cleanly',
        finalText.trim() === bbcode ? '' : 'final answer did not preserve the built BBCode',
      ].filter(Boolean)
    },
  },
  {
    id: 'avoid-redundant-validation',
    operation: 'build',
    prompt: 'Use the Nexus description MCP to build and verify a description from these facts: Name: Quiet Autosave. Tagline: Less intrusive save feedback. Overview: Replaces repeated save messages with one concise notification. Features: coalesces repeated notices; keeps manual saves visible. Return only clean Nexus BBCode.',
    verify: (call, finalText) => {
      const output = call.result?.structured_content
      const bbcode = String(output?.bbcode ?? '')
      const normalized = bbcode.toLowerCase()
      return [
        normalized.includes('quiet autosave') && normalized.includes('coalesces repeated notices') ? '' : 'build omitted supplied facts',
        Array.isArray(output?.issues) && output.issues.length === 0 ? '' : 'build did not return a clean validation result',
        finalText.trim() === bbcode ? '' : 'final answer did not preserve built BBCode',
      ].filter(Boolean)
    },
  },
  {
    id: 'editorial-description-quality',
    operation: 'build',
    prompt: 'Use the Nexus description MCP to build a polished, scannable, clean real-world Nexus listing using the editorial presentation. Use only these verified facts. Name: Signal Relay. Tagline: Clear radio status at a glance. Overview: A focused quality-of-life mod that makes radio state easier to understand without changing radio behavior. Features: shows the active channel clearly; coalesces repeated status notices; offers configurable notification duration; keeps manual channel changes visible. Installation: install the supported mod loader; place SignalRelay.dll in the Mods folder. How to use: launch the game after installation; change channels normally and watch the status notice. Requirements: the base game; a supported mod loader. Compatibility: designed for the current public game build. Known issue: notices can overlap during very rapid channel changes. Credits: created by the Signal Relay contributors. Return only the BBCode.',
    presentationScore: (call) => scoreNexusPresentation(String(call.result?.structured_content?.bbcode ?? '')).score,
    verify: (call, finalText) => {
      const output = call.result?.structured_content
      const bbcode = String(output?.bbcode ?? '')
      const score = scoreNexusPresentation(bbcode)
      const normalized = bbcode.toLowerCase()
      const required = ['signal relay', 'active channel clearly', 'signalrelay.dll', 'current public game build', 'very rapid channel changes', 'signal relay contributors']
      return [
        call.arguments.presentation === 'editorial' ? '' : 'model did not request the editorial presentation',
        required.every((text) => normalized.includes(text)) ? '' : 'description omitted a verified fact',
        score.score >= 90 ? '' : `presentation score ${score.score}/100 was below 90`,
        Array.isArray(output?.issues) && output.issues.length === 0 ? '' : 'description did not validate cleanly',
        finalText.trim() === bbcode ? '' : 'final answer did not preserve the built BBCode',
      ].filter(Boolean)
    },
  },
]

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const artifactRoot = resolve(root, '.artifacts', 'mcp-benchmark')
const scratch = join(artifactRoot, 'scratch')
const repetitions = Number(process.argv.find((arg) => arg.startsWith('--repetitions='))?.split('=')[1] ?? 2)
const concurrency = Number(process.argv.find((arg) => arg.startsWith('--concurrency='))?.split('=')[1] ?? 4)
const model = process.argv.find((arg) => arg.startsWith('--model='))?.split('=')[1] ?? 'gpt-5.6-luna'

const serverPaths: Record<Variant, string> = {
  split: resolve(root, 'mcp', 'server.ts'),
  consolidated: resolve(root, 'mcp', 'benchmark', 'serverConsolidated.ts'),
}

function expectedTool(variant: Variant, operation: Scenario['operation']) {
  if (variant === 'consolidated') return 'nexus_description'
  return operation === 'build' ? 'build_nexus_description' : operation === 'convert' ? 'convert_to_nexus_bbcode' : 'validate_nexus_bbcode'
}

function parseEvents(stdout: string) {
  return stdout.split(/\r?\n/).flatMap((line) => {
    if (!line.trim().startsWith('{')) return []
    try { return [JSON.parse(line) as Record<string, unknown>] } catch { return [] }
  })
}

async function runScenario(variant: Variant, effort: Effort, scenario: Scenario, repetition: number): Promise<RunResult> {
  const configArgs = JSON.stringify(['run', serverPaths[variant]])
  const args = [
    'exec', '--ignore-user-config', '--skip-git-repo-check', '--ephemeral', '--json',
    '--sandbox', 'read-only', '-C', scratch, '-m', model,
    '-c', `model_reasoning_effort="${effort}"`,
    '-c', 'mcp_servers.nexus.command="bun"',
    '-c', `mcp_servers.nexus.args=${configArgs}`,
    scenario.prompt,
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
  const calls = events.flatMap((event): McpCall[] => {
    if (event.type !== 'item.completed') return []
    const item = event.item as Record<string, unknown> | undefined
    if (item?.type !== 'mcp_tool_call') return []
    return [{
      tool: String(item.tool ?? ''),
      arguments: (item.arguments ?? {}) as Record<string, unknown>,
      result: item.result as McpCall['result'],
      error: item.error as McpCall['error'],
      status: String(item.status ?? ''),
    }]
  })
  const finalText = events.flatMap((event): string[] => {
    if (event.type !== 'item.completed') return []
    const item = event.item as Record<string, unknown> | undefined
    return item?.type === 'agent_message' ? [String(item.text ?? '')] : []
  }).at(-1) ?? ''
  const usageEvent = events.findLast((event) => event.type === 'turn.completed')
  const operationCall = calls.findLast((call) => call.status === 'completed' && !call.error
    && call.tool === expectedTool(variant, scenario.operation)
    && (variant !== 'consolidated' || call.arguments.action === scenario.operation))
  const integrationFailures = [
    exitCode === 0 ? '' : `codex exited ${exitCode}`,
    calls.length === 1 ? '' : `expected one MCP call, observed ${calls.length}`,
    calls.every((call) => call.status === 'completed' && !call.error) ? '' : 'one or more MCP calls failed',
    operationCall ? '' : `no successful ${scenario.operation} operation call`,
  ].filter(Boolean)
  const taskFailures = operationCall ? scenario.verify(operationCall, finalText) : ['scenario could not be verified without a successful operation call']
  const failures = [...integrationFailures, ...taskFailures]

  return {
    variant, effort, scenario: scenario.id, repetition,
    passed: failures.length === 0,
    taskPassed: taskFailures.length === 0,
    cleanRun: integrationFailures.length === 0,
    failures, taskFailures, integrationFailures,
    durationMs: Math.round(performance.now() - started), calls, finalText,
    usage: usageEvent?.usage as Record<string, number> | undefined,
    exitCode, stderr,
    presentationScore: operationCall && scenario.presentationScore ? scenario.presentationScore(operationCall) : undefined,
  }
}

async function toolCatalogSize(serverPath: string) {
  const client = new Client({ name: 'nexus-benchmark-catalog', version: '1.0.0' })
  await client.connect(new StdioClientTransport({ command: 'bun', args: ['run', serverPath], cwd: root, stderr: 'pipe' }))
  const tools = (await client.listTools()).tools
  await client.close()
  return { tools: tools.length, characters: JSON.stringify(tools).length }
}

function mean(values: number[]) { return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length) }

function report(results: RunResult[], catalogs: Record<Variant, { tools: number; characters: number }>) {
  const groups = (['split', 'consolidated'] as const).flatMap((variant) => (['medium', 'high'] as const).map((effort) => {
    const runs = results.filter((result) => result.variant === variant && result.effort === effort)
    return {
      variant,
      effort,
      passed: runs.filter((run) => run.passed).length,
      taskPassed: runs.filter((run) => run.taskPassed).length,
      cleanRuns: runs.filter((run) => run.cleanRun).length,
      runs: runs.length,
      passRate: runs.filter((run) => run.passed).length / runs.length,
      meanDurationMs: Math.round(mean(runs.map((run) => run.durationMs))),
      meanInputTokens: Math.round(mean(runs.map((run) => run.usage?.input_tokens ?? 0))),
      meanOutputTokens: Math.round(mean(runs.map((run) => run.usage?.output_tokens ?? 0))),
      meanCalls: Number(mean(runs.map((run) => run.calls.length)).toFixed(2)),
      meanPresentationScore: runs.some((run) => run.presentationScore !== undefined)
        ? Number(mean(runs.flatMap((run) => run.presentationScore === undefined ? [] : [run.presentationScore])).toFixed(1))
        : undefined,
    }
  }))
  return { model, repetitions, scenarios: scenarios.length, catalogs, groups, results }
}

function markdownReport(data: ReturnType<typeof report>) {
  const rows = data.groups.map((group) => `| ${group.variant} | ${group.effort} | ${group.taskPassed}/${group.runs} | ${group.cleanRuns}/${group.runs} | ${group.passed}/${group.runs} | ${group.meanPresentationScore ?? 'n/a'} | ${group.meanDurationMs} | ${group.meanInputTokens} | ${group.meanOutputTokens} | ${group.meanCalls} |`).join('\n')
  const failures = data.results.filter((result) => !result.passed).map((result) => `- ${result.variant}/${result.effort}/${result.scenario}/r${result.repetition}: ${result.failures.join('; ')}`).join('\n') || '- None'
  return `# Nexus MCP model benchmark\n\nModel: \`${data.model}\`  \nRepetitions: ${data.repetitions}  \nScenarios: ${data.scenarios}\n\n## Tool catalog size\n\n- Split: ${data.catalogs.split.tools} tools, ${data.catalogs.split.characters} serialized characters.\n- Consolidated: ${data.catalogs.consolidated.tools} tool, ${data.catalogs.consolidated.characters} serialized characters.\n\n## Results\n\nTask pass means the returned content was correct. Clean run means one correctly routed call with no failed/redundant calls. Strict pass requires both. Presentation is a deterministic 100-point score for the editorial scenario, emphasizing valid Nexus BBCode, hierarchy, scannability, completeness, and restraint.\n\n| Design | Effort | Task pass | Clean run | Strict pass | Presentation /100 | Mean latency ms | Mean input tokens | Mean output tokens | Mean calls |\n| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n${rows}\n\n## Strict-pass failures\n\n${failures}\n`
}

await mkdir(scratch, { recursive: true })
const catalogs = {
  split: await toolCatalogSize(serverPaths.split),
  consolidated: await toolCatalogSize(serverPaths.consolidated),
}
const jobs = (['split', 'consolidated'] as const).flatMap((variant) =>
  (['medium', 'high'] as const).flatMap((effort) =>
    scenarios.flatMap((scenario) => Array.from({ length: repetitions }, (_, index) => ({ variant, effort, scenario, repetition: index + 1 }))),
  ),
)
const results: RunResult[] = []
let cursor = 0
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (cursor < jobs.length) {
    const job = jobs[cursor++]!
    const result = await runScenario(job.variant, job.effort, job.scenario, job.repetition)
    results.push(result)
    console.log(`${result.passed ? 'PASS' : 'FAIL'} ${job.variant}/${job.effort}/${job.scenario.id}/r${job.repetition} ${result.durationMs}ms`)
  }
}))
results.sort((a, b) => `${a.variant}-${a.effort}-${a.scenario}-${a.repetition}`.localeCompare(`${b.variant}-${b.effort}-${b.scenario}-${b.repetition}`))
const data = report(results, catalogs)
await writeFile(join(artifactRoot, 'latest.json'), `${JSON.stringify(data, null, 2)}\n`)
await writeFile(join(artifactRoot, 'latest.md'), markdownReport(data))
console.log(markdownReport(data))
if (results.some((result) => !result.passed)) process.exitCode = 1
