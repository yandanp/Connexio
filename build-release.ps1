# Connexio Build Script with Updater Signing
# This script sets the required environment variables for signing updates

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Connexio Release Build" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Set signing environment variables
$env:TAURI_SIGNING_PRIVATE_KEY = "$PSScriptRoot\.tauri-key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
$env:PATH = "$env:PATH;$env:USERPROFILE\.cargo\bin"

Write-Host "Private key: $($env:TAURI_SIGNING_PRIVATE_KEY)" -ForegroundColor DarkGray
Write-Host ""

# Build NSIS installer
Write-Host "[1/2] Building NSIS installer..." -ForegroundColor Yellow
& npx tauri build --bundles nsis
if ($LASTEXITCODE -ne 0) {
    Write-Host "NSIS build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/2] Building MSI installer..." -ForegroundColor Yellow
& npx tauri build --bundles msi
if ($LASTEXITCODE -ne 0) {
    Write-Host "MSI build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# List artifacts
Write-Host "Installer artifacts:" -ForegroundColor White
Get-ChildItem -Path "src-tauri\target\release\bundle\nsis\*.exe" -ErrorAction SilentlyContinue | ForEach-Object {
    $size = [math]::Round($_.Length / 1MB, 2)
    Write-Host "  $($_.Name) ($size MB)" -ForegroundColor Green
}
Get-ChildItem -Path "src-tauri\target\release\bundle\msi\*.msi" -ErrorAction SilentlyContinue | ForEach-Object {
    $size = [math]::Round($_.Length / 1MB, 2)
    Write-Host "  $($_.Name) ($size MB)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Updater artifacts (for GitHub release):" -ForegroundColor White
Get-ChildItem -Path "src-tauri\target\release\bundle\nsis\*.nsis.zip" -ErrorAction SilentlyContinue | ForEach-Object {
    $size = [math]::Round($_.Length / 1MB, 2)
    Write-Host "  $($_.Name) ($size MB)" -ForegroundColor Green
}
Get-ChildItem -Path "src-tauri\target\release\bundle\nsis\*.sig" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  $($_.Name)" -ForegroundColor Green
}
Write-Host ""
