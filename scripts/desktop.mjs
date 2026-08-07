/* global Bun, process */

const [command, ...argumentsToForward] = Bun.argv.slice(2)

if (!['dev', 'build', 'check'].includes(command)) {
  throw new Error('Usage: bun scripts/desktop.mjs <dev|build|check> [arguments]')
}

const invocation = process.platform === 'win32'
  ? ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/desktop.ps1', command]
  : command === 'check'
    ? ['cargo', 'check', '--manifest-path', 'src-tauri/Cargo.toml', ...argumentsToForward]
    : ['bun', 'run', 'tauri', '--', command, ...argumentsToForward]

const environment = { ...process.env }
if (process.platform === 'win32') {
  environment.MOD_DESCRIPTION_WORKBENCH_DESKTOP_ARGS = JSON.stringify(argumentsToForward)
}

const child = Bun.spawn(invocation, { cwd: process.cwd(), env: environment, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' })
process.exit(await child.exited)
