# Connexio Context Menu Registration Script
# Story 6.1: Add Explorer Context Menu Integration
#
# This script adds "Open in Connexio" to the Windows Explorer context menu.
# Run as Administrator for system-wide installation, or as normal user for current user only.

param(
    [Parameter()]
    [string]$InstallPath,
    
    [Parameter()]
    [switch]$Uninstall,
    
    [Parameter()]
    [switch]$AllUsers
)

$ErrorActionPreference = "Stop"

# Determine registry root based on scope
if ($AllUsers) {
    $RegRoot = "HKLM:\Software\Classes"
    Write-Host "Installing for all users (requires Administrator)" -ForegroundColor Yellow
} else {
    $RegRoot = "HKCU:\Software\Classes"
    Write-Host "Installing for current user" -ForegroundColor Green
}

# Find Connexio executable
if ([string]::IsNullOrEmpty($InstallPath)) {
    # Try to find in common locations
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

if ($Uninstall) {
    Write-Host "Removing Connexio context menu entries..." -ForegroundColor Cyan
    
    # Remove folder context menu
    if (Test-Path "$RegRoot\Directory\shell\Connexio") {
        Remove-Item -Path "$RegRoot\Directory\shell\Connexio" -Recurse -Force
        Write-Host "  Removed: Directory context menu" -ForegroundColor Green
    }
    
    # Remove folder background context menu
    if (Test-Path "$RegRoot\Directory\Background\shell\Connexio") {
        Remove-Item -Path "$RegRoot\Directory\Background\shell\Connexio" -Recurse -Force
        Write-Host "  Removed: Directory background context menu" -ForegroundColor Green
    }
    
    # Remove drive context menu
    if (Test-Path "$RegRoot\Drive\shell\Connexio") {
        Remove-Item -Path "$RegRoot\Drive\shell\Connexio" -Recurse -Force
        Write-Host "  Removed: Drive context menu" -ForegroundColor Green
    }
    
    Write-Host "`nConnexio context menu entries removed successfully!" -ForegroundColor Green
    exit 0
}

# Verify executable exists
if ([string]::IsNullOrEmpty($InstallPath) -or !(Test-Path $InstallPath)) {
    Write-Host "Error: Connexio executable not found!" -ForegroundColor Red
    Write-Host "Please specify the path using -InstallPath parameter" -ForegroundColor Yellow
    Write-Host "Example: .\register-context-menu.ps1 -InstallPath 'C:\Path\To\Connexio.exe'" -ForegroundColor Yellow
    exit 1
}

Write-Host "Using Connexio at: $InstallPath" -ForegroundColor Cyan
Write-Host "Adding context menu entries..." -ForegroundColor Cyan

# Create registry entries for folder context menu
$folderKey = "$RegRoot\Directory\shell\Connexio"
New-Item -Path $folderKey -Force | Out-Null
Set-ItemProperty -Path $folderKey -Name "(Default)" -Value "Open in Connexio"
Set-ItemProperty -Path $folderKey -Name "Icon" -Value "`"$InstallPath`",0"
New-Item -Path "$folderKey\command" -Force | Out-Null
Set-ItemProperty -Path "$folderKey\command" -Name "(Default)" -Value "`"$InstallPath`" `"%V`""
Write-Host "  Added: Directory context menu" -ForegroundColor Green

# Create registry entries for folder background context menu
$bgKey = "$RegRoot\Directory\Background\shell\Connexio"
New-Item -Path $bgKey -Force | Out-Null
Set-ItemProperty -Path $bgKey -Name "(Default)" -Value "Open in Connexio"
Set-ItemProperty -Path $bgKey -Name "Icon" -Value "`"$InstallPath`",0"
New-Item -Path "$bgKey\command" -Force | Out-Null
Set-ItemProperty -Path "$bgKey\command" -Name "(Default)" -Value "`"$InstallPath`" `"%V`""
Write-Host "  Added: Directory background context menu" -ForegroundColor Green

# Create registry entries for drive context menu
$driveKey = "$RegRoot\Drive\shell\Connexio"
New-Item -Path $driveKey -Force | Out-Null
Set-ItemProperty -Path $driveKey -Name "(Default)" -Value "Open in Connexio"
Set-ItemProperty -Path $driveKey -Name "Icon" -Value "`"$InstallPath`",0"
New-Item -Path "$driveKey\command" -Force | Out-Null
Set-ItemProperty -Path "$driveKey\command" -Name "(Default)" -Value "`"$InstallPath`" `"%V`""
Write-Host "  Added: Drive context menu" -ForegroundColor Green

Write-Host "`nConnexio context menu entries added successfully!" -ForegroundColor Green
Write-Host "You can now right-click on folders to 'Open in Connexio'" -ForegroundColor Cyan
