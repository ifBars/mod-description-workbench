param(
  [int]$Iterations = 5,
  [string]$SeaPath = '.artifacts/release/staging/nexus-description-mcp.exe',
  [string]$BunPath = '.artifacts/release/staging/nexus-description-mcp-bun-fallback.exe'
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$cases = @(
  [pscustomobject]@{ Runtime = 'Node SEA'; Path = (Resolve-Path $SeaPath).Path },
  [pscustomobject]@{ Runtime = 'Bun fallback'; Path = (Resolve-Path $BunPath).Path }
)

function Send-Message([Diagnostics.Process]$Process, [hashtable]$Message) {
  $Process.StandardInput.WriteLine(($Message | ConvertTo-Json -Compress -Depth 20))
  $Process.StandardInput.Flush()
}

function Read-Response([Diagnostics.Process]$Process, [int]$Id) {
  $read = $Process.StandardOutput.ReadLineAsync()
  if (-not $read.Wait(15000)) { throw "Timed out waiting for MCP response $Id." }
  $message = $read.Result | ConvertFrom-Json
  if ($message.id -ne $Id) { throw "Expected MCP response $Id, received $($message.id)." }
  return $message
}

function Measure-McpProcess($Case, [int]$Iteration) {
  $info = [Diagnostics.ProcessStartInfo]::new()
  $info.FileName = $Case.Path
  $info.WorkingDirectory = $root
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardInput = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $process = [Diagnostics.Process]::new()
  $process.StartInfo = $info

  try {
    [void]$process.Start()
    Send-Message $process @{ jsonrpc = '2.0'; id = 1; method = 'initialize'; params = @{ protocolVersion = '2025-06-18'; capabilities = @{}; clientInfo = @{ name = 'runtime-memory-benchmark'; version = '1.0.0' } } }
    [void](Read-Response $process 1)
    Send-Message $process @{ jsonrpc = '2.0'; method = 'notifications/initialized'; params = @{} }
    Send-Message $process @{ jsonrpc = '2.0'; id = 2; method = 'tools/list'; params = @{} }
    [void](Read-Response $process 2)
    Send-Message $process @{ jsonrpc = '2.0'; id = 3; method = 'resources/read'; params = @{ uri = 'ui://nexus-description/preview-v1.html' } }
    $resource = Read-Response $process 3
    if (-not $resource.result.contents[0].text.Contains('ui/notifications/tool-result')) { throw 'Embedded preview resource mismatch.' }

    Start-Sleep -Milliseconds 1200
    $process.Refresh()
    $perf = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process -Filter "IDProcess = $($process.Id)"
    [pscustomobject]@{
      Runtime = $Case.Runtime
      Iteration = $Iteration
      PrivateWorkingSetMB = [Math]::Round([double]$perf.WorkingSetPrivate / 1MB, 2)
      WorkingSetMB = [Math]::Round($process.WorkingSet64 / 1MB, 2)
      ExecutableMB = [Math]::Round((Get-Item $Case.Path).Length / 1MB, 2)
    }
  } finally {
    if (-not $process.HasExited) {
      $process.StandardInput.Close()
      if (-not $process.WaitForExit(3000)) {
        $process.Kill($true)
        $process.WaitForExit()
      }
    }
    $process.Dispose()
  }
}

$results = for ($iteration = 1; $iteration -le $Iterations; $iteration += 1) {
  $orderedCases = if ($iteration % 2 -eq 1) { $cases } else { @($cases[1], $cases[0]) }
  foreach ($case in $orderedCases) { Measure-McpProcess $case $iteration }
}

$summary = $results | Group-Object Runtime | ForEach-Object {
  [pscustomobject]@{
    Runtime = $_.Name
    Runs = $_.Count
    PrivateWorkingSetMeanMB = [Math]::Round(($_.Group.PrivateWorkingSetMB | Measure-Object -Average).Average, 2)
    WorkingSetMeanMB = [Math]::Round(($_.Group.WorkingSetMB | Measure-Object -Average).Average, 2)
    ExecutableMB = $_.Group[0].ExecutableMB
  }
}
$summary | Sort-Object Runtime | Format-Table -AutoSize

$sea = $summary | Where-Object Runtime -eq 'Node SEA'
$bun = $summary | Where-Object Runtime -eq 'Bun fallback'
if ($sea.PrivateWorkingSetMeanMB -ge ($bun.PrivateWorkingSetMeanMB * 0.6)) {
  throw "Node SEA private working set regression: $($sea.PrivateWorkingSetMeanMB) MB versus Bun $($bun.PrivateWorkingSetMeanMB) MB."
}

$reduction = [Math]::Round((1 - ($sea.PrivateWorkingSetMeanMB / $bun.PrivateWorkingSetMeanMB)) * 100, 1)
Write-Host "Node SEA private working set is $reduction% lower than the Bun fallback."
