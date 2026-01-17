# Connexio Portable ZIP Build Script
# Story 6.6: Build Portable ZIP Distribution
#
# This script creates a portable ZIP distribution of Connexio
# that can be run without installation.
#
# Usage:
#   .\build-portable.ps1                    # Build to .\dist-portable
#   .\build-portable.ps1 -OutputDir "D:\builds"  # Build to custom directory
#   .\build-portable.ps1 -SkipBuild         # Package existing build

param(
    [Parameter()]
    [string]$OutputDir = ".\dist-portable",
    
    [Parameter()]
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Connexio Portable Distribution Builder" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Get version from package.json
$packageJson = Get-Content -Path "package.json" -Raw | ConvertFrom-Json
$version = $packageJson.version

Write-Host "  Version: $version" -ForegroundColor Green
Write-Host "  Output:  $OutputDir" -ForegroundColor Green
Write-Host ""

# Build the Tauri application if not skipping
if (-not $SkipBuild) {
    Write-Host "[1/5] Building Tauri application..." -ForegroundColor Yellow
    Write-Host "      This may take several minutes on first build." -ForegroundColor DarkGray
    Write-Host ""
    
    # Set PATH for cargo
    $env:PATH = "$env:PATH;$env:USERPROFILE\.cargo\bin"
    
    # Build without bundler (just the executable)
    & npm run tauri build -- --no-bundle
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "ERROR: Build failed!" -ForegroundColor Red
        Write-Host "Check the output above for details." -ForegroundColor Red
        exit 1
    }
    Write-Host ""
} else {
    Write-Host "[1/5] Skipping build (using existing)..." -ForegroundColor Yellow
}

# Find the built executable
$exePath = "src-tauri\target\release\Connexio.exe"
if (!(Test-Path $exePath)) {
    Write-Host ""
    Write-Host "ERROR: Built executable not found at $exePath" -ForegroundColor Red
    Write-Host "Run without -SkipBuild to build first." -ForegroundColor Yellow
    exit 1
}

$exeSize = [math]::Round((Get-Item $exePath).Length / 1MB, 2)
Write-Host "[2/5] Executable found: $exePath ($exeSize MB)" -ForegroundColor Green

# Create output directory structure
Write-Host "[3/5] Creating portable package structure..." -ForegroundColor Yellow

if (Test-Path $OutputDir) {
    Remove-Item -Path $OutputDir -Recurse -Force
}
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$portableDir = Join-Path $OutputDir "Connexio-$version-portable"
New-Item -ItemType Directory -Path $portableDir -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $portableDir "config") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $portableDir "scripts") -Force | Out-Null

# Copy executable
Copy-Item -Path $exePath -Destination $portableDir

# Copy helper scripts
if (Test-Path "scripts\register-context-menu.ps1") {
    Copy-Item -Path "scripts\register-context-menu.ps1" -Destination (Join-Path $portableDir "scripts")
}
if (Test-Path "scripts\register-default-terminal.ps1") {
    Copy-Item -Path "scripts\register-default-terminal.ps1" -Destination (Join-Path $portableDir "scripts")
}

# Create portable marker file (tells app to use local config)
$portableMarker = Join-Path $portableDir ".portable"
@"
# Connexio Portable Mode
# 
# This file indicates portable mode is active.
# Configuration is stored in ./config/ relative to executable.
# Delete this file to use %APPDATA% instead.
"@ | Out-File -FilePath $portableMarker -Encoding utf8

# Create README for portable
Write-Host "[4/5] Creating documentation..." -ForegroundColor Yellow

$readme = @"
# Connexio Portable Edition v$version

Modern Windows terminal with automatic session persistence.

## Quick Start

1. Run ``Connexio.exe`` to start the terminal
2. Your settings and sessions are saved in the ``config`` folder
3. Move this entire folder anywhere - your settings travel with you!

## Features

- **Session Persistence**: Tabs, directories, and settings auto-saved
- **Multi-Shell**: PowerShell, CMD, WSL, Git Bash
- **Themes**: 5 beautiful built-in themes
- **Workspaces**: Organize tabs into project-based workspaces

## Command Line Options

| Option | Description |
|--------|-------------|
| ``-d <path>`` | Open terminal in specified directory |
| ``-e <cmd>`` | Execute a command on startup |
| ``<path>`` | Open in directory (for context menu) |

### Examples

``````batch
Connexio.exe -d "C:\Projects\MyApp"
Connexio.exe -e "npm run dev"
Connexio.exe "C:\Users\Documents"
``````

## Add to Context Menu (Optional)

To add "Open in Connexio" to Windows Explorer right-click menu:

1. Open PowerShell in this folder
2. Run: ``.\scripts\register-context-menu.ps1``

To remove:
``````powershell
.\scripts\register-context-menu.ps1 -Uninstall
``````

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+T | New tab |
| Ctrl+W | Close tab |
| Ctrl+Tab | Next tab |
| Ctrl+Shift+Tab | Previous tab |
| Ctrl+1-9 | Switch to tab |
| Ctrl+, | Settings |

## Portable vs Installed

| Feature | Portable | Installed |
|---------|----------|-----------|
| Config location | ./config/ | %APPDATA%\Connexio |
| Context menu | Manual setup | Automatic |
| Start menu | No | Yes |
| Updates | Manual | Manual |

## Support

- GitHub: https://github.com/yandanp/Connexio
- Issues: https://github.com/yandanp/Connexio/issues

---
Made with ❤️ by yandanp
"@
$readme | Out-File -FilePath (Join-Path $portableDir "README.md") -Encoding utf8

# Create LICENSE file
$license = @"
MIT License

Copyright (c) 2026 yandanp

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"@
$license | Out-File -FilePath (Join-Path $portableDir "LICENSE") -Encoding utf8

# Create ZIP archive
Write-Host "[5/5] Creating ZIP archive..." -ForegroundColor Yellow

$zipPath = Join-Path $OutputDir "Connexio-$version-portable-win64.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}
Compress-Archive -Path $portableDir -DestinationPath $zipPath -Force

# Get final sizes
$zipSize = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Executable: $exeSize MB" -ForegroundColor White
Write-Host "  ZIP Archive: $zipSize MB" -ForegroundColor White
Write-Host ""
Write-Host "  Output files:" -ForegroundColor White
Write-Host "    $zipPath" -ForegroundColor Green
Write-Host "    $portableDir\" -ForegroundColor Green
Write-Host ""

# Verify size is within spec (< 15 MB per NFR-P10)
if ($zipSize -lt 15) {
    Write-Host "  [OK] Size is within specification (< 15 MB)" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Size exceeds specification (> 15 MB)" -ForegroundColor Yellow
}
Write-Host ""
