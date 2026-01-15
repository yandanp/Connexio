# Connexio Portable ZIP Build Script
# Story 6.6: Build Portable ZIP Distribution
#
# This script creates a portable ZIP distribution of Connexio
# that can be run without installation.

param(
    [Parameter()]
    [string]$OutputDir = ".\dist-portable"
)

$ErrorActionPreference = "Stop"

Write-Host "Building Connexio Portable Distribution" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

# Get version from package.json
$packageJson = Get-Content -Path "package.json" -Raw | ConvertFrom-Json
$version = $packageJson.version

Write-Host "Version: $version" -ForegroundColor Green

# Build the Tauri application without bundler
Write-Host "`nBuilding Tauri application..." -ForegroundColor Yellow
npm run tauri:build:portable
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Find the built executable
$exePath = "src-tauri\target\release\Connexio.exe"
if (!(Test-Path $exePath)) {
    Write-Host "Error: Built executable not found at $exePath" -ForegroundColor Red
    exit 1
}

Write-Host "Executable found at: $exePath" -ForegroundColor Green

# Create output directory
if (Test-Path $OutputDir) {
    Remove-Item -Path $OutputDir -Recurse -Force
}
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

# Create portable structure
$portableDir = Join-Path $OutputDir "Connexio-$version-portable"
New-Item -ItemType Directory -Path $portableDir -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $portableDir "config") -Force | Out-Null

# Copy executable
Copy-Item -Path $exePath -Destination $portableDir

# Copy helper scripts
$scriptsDir = Join-Path $portableDir "scripts"
New-Item -ItemType Directory -Path $scriptsDir -Force | Out-Null
Copy-Item -Path "scripts\register-context-menu.ps1" -Destination $scriptsDir
Copy-Item -Path "scripts\register-default-terminal.ps1" -Destination $scriptsDir

# Create portable marker file (tells app to use local config)
$portableMarker = Join-Path $portableDir ".portable"
"# Connexio Portable Mode`n# Config stored in ./config/ relative to executable" | Out-File -FilePath $portableMarker -Encoding utf8

# Create README for portable
$readme = @"
# Connexio Portable Edition v$version

## Quick Start
1. Run `Connexio.exe` to start the terminal
2. Your settings will be saved in the `config` folder

## Add to Context Menu (Optional)
Run PowerShell as Administrator and execute:
```powershell
.\scripts\register-context-menu.ps1 -InstallPath "$(Resolve-Path $portableDir)\Connexio.exe"
```

## Remove Context Menu
```powershell
.\scripts\register-context-menu.ps1 -Uninstall
```

## Command Line Options
- `-d <path>` or `--directory <path>`: Open in specified directory
- `-e <cmd>` or `--execute <cmd>`: Execute a command
- `<path>`: Open in specified directory (for context menu)

## Examples
```
Connexio.exe -d "C:\Projects\MyApp"
Connexio.exe -e "npm run dev"
Connexio.exe "C:\Users\Documents"
```
"@
$readme | Out-File -FilePath (Join-Path $portableDir "README.md") -Encoding utf8

# Create ZIP archive
$zipPath = Join-Path $OutputDir "Connexio-$version-portable-win64.zip"
Write-Host "`nCreating ZIP archive..." -ForegroundColor Yellow
Compress-Archive -Path $portableDir -DestinationPath $zipPath -Force

# Get file sizes
$exeSize = [math]::Round((Get-Item $exePath).Length / 1MB, 2)
$zipSize = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)

Write-Host "`n=======================================" -ForegroundColor Cyan
Write-Host "Build Complete!" -ForegroundColor Green
Write-Host "  Executable size: $exeSize MB" -ForegroundColor White
Write-Host "  ZIP archive size: $zipSize MB" -ForegroundColor White
Write-Host "  Output: $zipPath" -ForegroundColor White
