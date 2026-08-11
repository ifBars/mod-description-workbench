param(
  [string]$Version,
  [string]$AssetPath,
  [string]$ChecksumPath,
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'ModDescriptionWorkbench\MCP'),
  [switch]$SkipCodexRegistration
)

$ErrorActionPreference = 'Stop'
$repository = 'ifBars/mod-description-workbench'
$serverName = 'nexus-description-workbench'

if (-not $Version) {
  $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repository/releases/latest" -Headers @{ 'User-Agent' = 'Nexus-Description-MCP-Installer' }
  $Version = $release.tag_name -replace '^v', ''
} elseif (-not $AssetPath) {
  $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repository/releases/tags/v$Version" -Headers @{ 'User-Agent' = 'Nexus-Description-MCP-Installer' }
}

$assetName = "Nexus.Description.MCP_${Version}_windows-x64.zip"
$versionRoot = Join-Path $InstallRoot $Version
$serverPath = Join-Path $versionRoot 'nexus-description-mcp.exe'
$archivePath = Join-Path $versionRoot $assetName
New-Item -ItemType Directory -Path $versionRoot -Force | Out-Null

if ($AssetPath) {
  $resolvedAsset = (Resolve-Path -LiteralPath $AssetPath).Path
  Copy-Item -LiteralPath $resolvedAsset -Destination $archivePath -Force
  if ($ChecksumPath) { $checksumText = Get-Content -LiteralPath $ChecksumPath -Raw }
} else {
  $asset = $release.assets | Where-Object name -eq $assetName | Select-Object -First 1
  if (-not $asset) { throw "Release v$Version does not contain $assetName." }
  Invoke-WebRequest -UseBasicParsing -Uri $asset.browser_download_url -OutFile $archivePath -Headers @{ 'User-Agent' = 'Nexus-Description-MCP-Installer' }
  $checksumAsset = $release.assets | Where-Object name -eq 'SHA256SUMS.txt' | Select-Object -First 1
  if (-not $checksumAsset) { throw "Release v$Version does not contain SHA256SUMS.txt." }
  $checksumContent = (Invoke-WebRequest -UseBasicParsing -Uri $checksumAsset.browser_download_url -Headers @{ 'User-Agent' = 'Nexus-Description-MCP-Installer' }).Content
  $checksumText = if ($checksumContent -is [byte[]]) {
    [System.Text.Encoding]::UTF8.GetString($checksumContent)
  } else {
    [string]$checksumContent
  }
}

if ($checksumText) {
  $pattern = "(?im)^([a-f0-9]{64})\s+$([regex]::Escape($assetName))$"
  $checksumMatch = [regex]::Match($checksumText, $pattern)
  if (-not $checksumMatch.Success) { throw "No checksum was published for $assetName." }
  $actualChecksum = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
  if ($actualChecksum -ne $checksumMatch.Groups[1].Value) { throw "Checksum verification failed for $assetName." }
}

Expand-Archive -LiteralPath $archivePath -DestinationPath $versionRoot -Force
Remove-Item -LiteralPath $archivePath -Force

if (-not (Test-Path -LiteralPath $serverPath) -or (Get-Item -LiteralPath $serverPath).Length -eq 0) {
  throw 'The downloaded MCP executable is missing or empty.'
}

if (-not $SkipCodexRegistration) {
  if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
    throw "Codex CLI was not found. The server was installed to $serverPath; add that executable as a local STDIO MCP server in your client."
  }

  & codex mcp get $serverName *> $null
  if ($LASTEXITCODE -eq 0) {
    & codex mcp remove $serverName | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not replace the existing Codex MCP registration.' }
  }

  & codex mcp add $serverName -- $serverPath
  if ($LASTEXITCODE -ne 0) { throw 'Could not register the MCP server with Codex.' }
}

Write-Host "Nexus Description MCP $Version installed at $serverPath"
if (-not $SkipCodexRegistration) { Write-Host 'Restart Codex, then use /mcp to confirm the server is connected.' }
