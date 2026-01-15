# Connexio Default Terminal Registration Script
# Story 6.4: Register as Default Terminal Application
#
# This script registers Connexio as a terminal application in Windows.
# For Windows 11+, it can be set as the default terminal in Settings.
#
# NOTE: Setting the actual default terminal requires user action in Windows Settings
# This script only registers Connexio as an available terminal option.

param(
    [Parameter()]
    [string]$InstallPath,
    
    [Parameter()]
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

# Find Connexio executable
if ([string]::IsNullOrEmpty($InstallPath)) {
    $possiblePaths = @(
        "$env:LOCALAPPDATA\Connexio\Connexio.exe",
        "$env:ProgramFiles\Connexio\Connexio.exe",
        "$PSScriptRoot\Connexio.exe",
        ".\Connexio.exe"
    )
    
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            $InstallPath = (Resolve-Path $path).Path
            break
        }
    }
}

$TerminalGuid = "{58e66a91-b07f-4a9c-a8e0-2e0e3c8a7f5d}"
$RegPath = "HKCU:\Console\%%Startup"

if ($Uninstall) {
    Write-Host "Removing Connexio as terminal application..." -ForegroundColor Cyan
    
    # Remove App Execution Alias (if exists)
    $aliasPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\connexio.exe"
    if (Test-Path $aliasPath) {
        Remove-Item -Path $aliasPath -Force
        Write-Host "  Removed: App path alias" -ForegroundColor Green
    }
    
    Write-Host "`nConnexio terminal registration removed." -ForegroundColor Green
    Write-Host "Note: If you set Connexio as default terminal in Windows Settings," -ForegroundColor Yellow
    Write-Host "      you'll need to change it back manually." -ForegroundColor Yellow
    exit 0
}

# Verify executable exists
if ([string]::IsNullOrEmpty($InstallPath) -or !(Test-Path $InstallPath)) {
    Write-Host "Error: Connexio executable not found!" -ForegroundColor Red
    Write-Host "Please specify the path using -InstallPath parameter" -ForegroundColor Yellow
    exit 1
}

Write-Host "Using Connexio at: $InstallPath" -ForegroundColor Cyan
Write-Host "Registering Connexio as terminal application..." -ForegroundColor Cyan

# Add to App Paths for easy launching
$appPathKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\connexio.exe"
New-Item -Path $appPathKey -Force | Out-Null
Set-ItemProperty -Path $appPathKey -Name "(Default)" -Value $InstallPath
Set-ItemProperty -Path $appPathKey -Name "Path" -Value (Split-Path $InstallPath)
Write-Host "  Added: App path alias (run 'connexio' from Run dialog)" -ForegroundColor Green

# Add to PATH environment variable (user level)
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$connexioDir = Split-Path $InstallPath
if ($userPath -notlike "*$connexioDir*") {
    $newPath = "$userPath;$connexioDir"
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "  Added: Connexio directory to PATH" -ForegroundColor Green
} else {
    Write-Host "  Skipped: Already in PATH" -ForegroundColor Yellow
}

Write-Host "`nConnexio registered as terminal application!" -ForegroundColor Green
Write-Host "`nTo set Connexio as your default terminal:" -ForegroundColor Cyan
Write-Host "  1. Open Windows Settings" -ForegroundColor White
Write-Host "  2. Go to Privacy & Security > For developers" -ForegroundColor White
Write-Host "  3. Find 'Terminal' setting and select 'Connexio'" -ForegroundColor White
Write-Host "`nOr on Windows 11:" -ForegroundColor Cyan
Write-Host "  1. Open Windows Terminal Settings" -ForegroundColor White
Write-Host "  2. Go to Startup > Default terminal application" -ForegroundColor White
Write-Host "  3. Select 'Connexio'" -ForegroundColor White
