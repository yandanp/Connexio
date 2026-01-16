# Connexio Build Script with Updater Signing
# Run: powershell -ExecutionPolicy Bypass -File build-signed.ps1

Write-Host "Reading signing key..." -ForegroundColor Cyan
$privateKey = Get-Content ".tauri-key" -Raw
$env:TAURI_SIGNING_PRIVATE_KEY = $privateKey.Trim()
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""

Write-Host "Building Connexio with updater signing..." -ForegroundColor Green
Write-Host ""

# Run tauri build
npm run tauri:build

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================"  -ForegroundColor Green
    Write-Host "Build complete!" -ForegroundColor Green
    Write-Host "========================================"  -ForegroundColor Green
    Write-Host ""
    Write-Host "Installers:" -ForegroundColor Yellow
    Get-ChildItem "src-tauri\target\release\bundle\nsis\*.exe" -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  $_" }
    Get-ChildItem "src-tauri\target\release\bundle\msi\*.msi" -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  $_" }
    Write-Host ""
    Write-Host "Signatures:" -ForegroundColor Yellow
    Get-ChildItem "src-tauri\target\release\bundle\nsis\*.sig" -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  $_" }
    Get-ChildItem "src-tauri\target\release\bundle\msi\*.sig" -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  $_" }
} else {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}
