# Connexio Installer Build Script
# Story 6.5: Build MSI and NSIS Installers
#
# This script builds the MSI and/or NSIS installers for Connexio.
#
# Usage:
#   .\build-installer.ps1           # Build both MSI and NSIS
#   .\build-installer.ps1 -MSI      # Build MSI only
#   .\build-installer.ps1 -NSIS     # Build NSIS only

param(
    [Parameter()]
    [switch]$MSI,
    
    [Parameter()]
    [switch]$NSIS,
    
    [Parameter()]
    [string]$OutputDir = ".\dist-installer"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Connexio Installer Builder" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Get version from package.json
$packageJson = Get-Content -Path "package.json" -Raw | ConvertFrom-Json
$version = $packageJson.version

Write-Host "  Version: $version" -ForegroundColor Green

# Determine which installers to build
$buildTargets = @()
if ($MSI -and -not $NSIS) {
    $buildTargets = @("msi")
    Write-Host "  Target:  MSI only" -ForegroundColor Green
} elseif ($NSIS -and -not $MSI) {
    $buildTargets = @("nsis")
    Write-Host "  Target:  NSIS only" -ForegroundColor Green
} else {
    $buildTargets = @("msi", "nsis")
    Write-Host "  Target:  MSI + NSIS" -ForegroundColor Green
}
Write-Host ""

# Set PATH for cargo
$env:PATH = "$env:PATH;$env:USERPROFILE\.cargo\bin"

# Check prerequisites
Write-Host "[1/4] Checking prerequisites..." -ForegroundColor Yellow

# Check for Rust/Cargo
$cargoVersion = & cargo --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Cargo not found. Install Rust from https://rustup.rs" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] Cargo: $cargoVersion" -ForegroundColor DarkGray

# Check for Node.js
$nodeVersion = & node --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Node.js not found." -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] Node.js: $nodeVersion" -ForegroundColor DarkGray

# Check for WiX if building MSI
if ($buildTargets -contains "msi") {
    $wixPath = Get-Command light.exe -ErrorAction SilentlyContinue
    if (-not $wixPath) {
        Write-Host ""
        Write-Host "WARNING: WiX Toolset not found in PATH." -ForegroundColor Yellow
        Write-Host "MSI build may fail. Install from: https://wixtoolset.org/releases/" -ForegroundColor Yellow
        Write-Host "Or install via: winget install WixToolset.WixToolset" -ForegroundColor Yellow
        Write-Host ""
    } else {
        Write-Host "  [OK] WiX Toolset found" -ForegroundColor DarkGray
    }
}

# Check for NSIS if building NSIS installer
if ($buildTargets -contains "nsis") {
    $nsisPath = Get-Command makensis.exe -ErrorAction SilentlyContinue
    if (-not $nsisPath) {
        # Check common install locations
        $commonPaths = @(
            "${env:ProgramFiles(x86)}\NSIS\makensis.exe",
            "${env:ProgramFiles}\NSIS\makensis.exe"
        )
        foreach ($path in $commonPaths) {
            if (Test-Path $path) {
                $nsisPath = $path
                break
            }
        }
    }
    if (-not $nsisPath) {
        Write-Host ""
        Write-Host "WARNING: NSIS not found in PATH." -ForegroundColor Yellow
        Write-Host "NSIS build may fail. Install from: https://nsis.sourceforge.io/Download" -ForegroundColor Yellow
        Write-Host "Or install via: winget install NSIS.NSIS" -ForegroundColor Yellow
        Write-Host ""
    } else {
        Write-Host "  [OK] NSIS found" -ForegroundColor DarkGray
    }
}

Write-Host ""

# Build the installers
Write-Host "[2/4] Building Tauri application with installers..." -ForegroundColor Yellow
Write-Host "      This may take several minutes." -ForegroundColor DarkGray
Write-Host ""

$bundleArg = $buildTargets -join ","
& npm run tauri build -- --bundles $bundleArg

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[3/4] Locating build artifacts..." -ForegroundColor Yellow

# Find built installers
$releaseDir = "src-tauri\target\release\bundle"
$artifacts = @()

if ($buildTargets -contains "msi") {
    $msiFiles = Get-ChildItem -Path "$releaseDir\msi\*.msi" -ErrorAction SilentlyContinue
    foreach ($file in $msiFiles) {
        $artifacts += $file
        $size = [math]::Round($file.Length / 1MB, 2)
        Write-Host "  [OK] MSI: $($file.Name) ($size MB)" -ForegroundColor Green
    }
}

if ($buildTargets -contains "nsis") {
    $nsisFiles = Get-ChildItem -Path "$releaseDir\nsis\*.exe" -ErrorAction SilentlyContinue
    foreach ($file in $nsisFiles) {
        $artifacts += $file
        $size = [math]::Round($file.Length / 1MB, 2)
        Write-Host "  [OK] NSIS: $($file.Name) ($size MB)" -ForegroundColor Green
    }
}

if ($artifacts.Count -eq 0) {
    Write-Host "  [WARN] No installer artifacts found!" -ForegroundColor Yellow
    Write-Host "  Check: $releaseDir" -ForegroundColor Yellow
}

# Copy to output directory
Write-Host ""
Write-Host "[4/4] Copying to output directory..." -ForegroundColor Yellow

if (!(Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

foreach ($file in $artifacts) {
    $destPath = Join-Path $OutputDir $file.Name
    Copy-Item -Path $file.FullName -Destination $destPath -Force
    Write-Host "  -> $destPath" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Output directory: $OutputDir" -ForegroundColor White
Write-Host ""

# List final artifacts with sizes
Write-Host "  Artifacts:" -ForegroundColor White
$totalSize = 0
foreach ($file in $artifacts) {
    $size = [math]::Round($file.Length / 1MB, 2)
    $totalSize += $size
    Write-Host "    $($file.Name) - $size MB" -ForegroundColor Green
}
Write-Host ""

# Verify size is within spec (< 15 MB per NFR-P10)
foreach ($file in $artifacts) {
    $size = [math]::Round($file.Length / 1MB, 2)
    if ($size -lt 15) {
        Write-Host "  [OK] $($file.Name) is within spec (< 15 MB)" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] $($file.Name) exceeds spec (> 15 MB)" -ForegroundColor Yellow
    }
}
Write-Host ""
