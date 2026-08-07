param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('dev', 'build', 'check')]
  [string]$Command
)

$TauriArguments = if ($env:MOD_DESCRIPTION_WORKBENCH_DESKTOP_ARGS) {
  @($env:MOD_DESCRIPTION_WORKBENCH_DESKTOP_ARGS | ConvertFrom-Json)
} else { @() }

function Import-VisualStudioEnvironment {
  $vsWhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
  if (-not (Test-Path -LiteralPath $vsWhere)) {
    throw 'Visual Studio Installer (vswhere) is required to locate the Windows C++ toolchain.'
  }

  $installationRoot = & $vsWhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath |
    Where-Object {
      Get-ChildItem (Join-Path $_ 'VC\Tools\MSVC') -Directory -ErrorAction SilentlyContinue |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'include\excpt.h') }
    } |
    Select-Object -First 1
  if (-not $installationRoot) { throw 'A complete Visual Studio C++ toolchain is required to build the Windows desktop shell.' }

  $developerCommand = Join-Path $installationRoot 'Common7\Tools\VsDevCmd.bat'
  if (-not (Test-Path -LiteralPath $developerCommand)) { throw "Could not find Visual Studio developer command at $developerCommand." }

  $environment = cmd /c "call `"$developerCommand`" -arch=x64 -host_arch=x64 >nul && set"
  foreach ($entry in $environment) {
    if ($entry -match '^([^=]+)=(.*)$') {
      Set-Item -Path "Env:$($Matches[1])" -Value $Matches[2]
    }
  }
}

if ($env:OS -eq 'Windows_NT') {
  Import-VisualStudioEnvironment
}

if ($Command -eq 'check') {
  cargo check --manifest-path src-tauri/Cargo.toml @TauriArguments
} else {
  bun run tauri -- $Command @TauriArguments
}

exit $LASTEXITCODE
