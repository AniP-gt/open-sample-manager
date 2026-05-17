param(
  [switch]$Yes,
  [switch]$CheckOnly,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Info($Message) {
  Write-Host "[INFO] $Message"
}

function Write-Warn($Message) {
  Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Require-Command($Name, $InstallHint) {
  if (Get-Command $Name -ErrorAction SilentlyContinue) {
    Write-Info "Found $Name"
    return $true
  }

  Write-Warn "Missing $Name. $InstallHint"
  return $false
}

function Refresh-Path {
  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $extraPaths = @(
    (Join-Path $env:USERPROFILE ".cargo\bin"),
    "C:\Program Files\nodejs",
    "C:\Program Files\CMake\bin",
    "C:\ProgramData\chocolatey\bin",
    "C:\chocolatey\bin"
  )

  $env:Path = (@($machinePath, $userPath) + $extraPaths | Where-Object { $_ }) -join ";"
}

function Assert-VersionAtLeast($Name, $CurrentVersion, $RequiredVersion) {
  $current = [Version]$CurrentVersion
  $required = [Version]$RequiredVersion
  if ($current -lt $required) {
    throw "$Name $RequiredVersion or later is required. Current version: $CurrentVersion"
  }
}

function Check-ToolVersions {
  $nodeVersion = ((node --version).TrimStart("v"))
  Assert-VersionAtLeast "Node.js" $nodeVersion "20.0.0"

  $cmakeVersionLine = cmake --version | Select-Object -First 1
  $cmakeVersion = ($cmakeVersionLine -replace "^cmake version\s+", "").Trim()
  Assert-VersionAtLeast "CMake" $cmakeVersion "3.22.0"
}

function Install-WithWinget($PackageId, $Name) {
  if ($CheckOnly) {
    Write-Host "       winget install --id $PackageId --exact --source winget"
    return
  }

  if (-not $Yes) {
    Write-Warn "Missing $Name. Rerun with -Yes to install it with winget."
    return
  }

  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Warn "winget is not available. Install $Name manually, then rerun this script."
    return
  }

  winget install --id $PackageId --exact --source winget --accept-package-agreements --accept-source-agreements
}

function Install-TimidityHint {
  if (Get-Command timidity -ErrorAction SilentlyContinue) {
    Write-Info "Found TiMidity++ for MIDI playback"
    return
  }

  $knownPaths = @(
    "C:\Program Files\timidity\timidity.exe",
    "C:\Program Files (x86)\timidity\timidity.exe",
    "C:\msys64\mingw64\bin\timidity.exe",
    "C:\chocolatey\bin\timidity.exe"
  )

  foreach ($path in $knownPaths) {
    if (Test-Path $path) {
      Write-Info "Found TiMidity++ at $path"
      return
    }
  }

  if ($CheckOnly) {
    Write-Host "       choco install timidity -y"
    return
  }

  if ($Yes) {
    if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
      if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Info "Installing Chocolatey for TiMidity++..."
        winget install --id Chocolatey.Chocolatey --exact --source winget --accept-package-agreements --accept-source-agreements
        Refresh-Path
      }
    }

    if (Get-Command choco -ErrorAction SilentlyContinue) {
      choco install timidity -y
      Refresh-Path
      return
    }
  }

  Write-Warn "TiMidity++ is missing. MIDI playback needs TiMidity++ plus a soundfont. Install Chocolatey and run: choco install timidity -y"
}

Write-Info "Checking Windows build tools..."

if (-not (Get-Command rustup -ErrorAction SilentlyContinue)) {
  Install-WithWinget "Rustlang.Rustup" "Rust"
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Install-WithWinget "OpenJS.NodeJS.LTS" "Node.js LTS"
}
if (-not (Get-Command cmake -ErrorAction SilentlyContinue)) {
  Install-WithWinget "Kitware.CMake" "CMake"
}

Refresh-Path

if (-not (Get-Command cl -ErrorAction SilentlyContinue)) {
  Write-Warn "Microsoft C++ Build Tools may be missing. If Rust builds fail, install 'Desktop development with C++' from Visual Studio Installer."
  if ($Yes -and -not $CheckOnly -and (Get-Command winget -ErrorAction SilentlyContinue)) {
    winget install --id Microsoft.VisualStudio.2022.BuildTools --exact --source winget --accept-package-agreements --accept-source-agreements --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
  }
}

Install-TimidityHint

$hasRustup = Require-Command "rustup" "Install Rust from https://rustup.rs/"
$hasCargo = Require-Command "cargo" "Cargo should be available after Rust installation. Restart PowerShell if it was installed just now."
$hasNode = Require-Command "node" "Install Node.js 20 LTS or later."
$hasNpm = Require-Command "npm" "npm ships with Node.js. Restart PowerShell if Node.js was installed just now."
$hasCmake = Require-Command "cmake" "Install CMake 3.22 or later."

if ($CheckOnly) {
  Write-Info "Check complete. No project dependencies were installed."
  exit 0
}

if (-not ($hasRustup -and $hasCargo -and $hasNode -and $hasNpm -and $hasCmake)) {
  throw "Required build tools are still missing. Restart PowerShell if tools were just installed, then rerun .\\install.ps1"
}

Check-ToolVersions

Write-Info "Installing Rust toolchain from rust-toolchain.toml..."
rustup show active-toolchain | Out-Null

Write-Info "Installing root npm dependencies..."
npm install --prefix $RootDir

Write-Info "Installing UI npm dependencies..."
npm install --prefix (Join-Path $RootDir "ui")

Write-Info "Checking Rust workspace..."
cargo check --workspace

Write-Info "Checking UI types..."
npm run typecheck --prefix (Join-Path $RootDir "ui")

if (-not $SkipBuild) {
  Write-Info "Building desktop app package..."
  npm run build:app --prefix $RootDir
}

Write-Info "Install finished."
Write-Info "Development: npm run tauri:dev"
Write-Info "Production build: npm run build:app"
