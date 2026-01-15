@echo off
REM Connexio Build Script with Updater Signing
REM This script sets the required environment variables for signing updates

set TAURI_SIGNING_PRIVATE_KEY=%~dp0.tauri-key
set TAURI_SIGNING_PRIVATE_KEY_PASSWORD=

echo Building Connexio with updater signing...
echo Private key: %TAURI_SIGNING_PRIVATE_KEY%
echo.

REM Build NSIS installer
npm run tauri:build:nsis
if %ERRORLEVEL% neq 0 (
    echo NSIS build failed!
    exit /b 1
)

REM Build MSI installer
npm run tauri:build:msi
if %ERRORLEVEL% neq 0 (
    echo MSI build failed!
    exit /b 1
)

echo.
echo Build complete!
echo Artifacts:
dir /b src-tauri\target\release\bundle\nsis\*.exe 2>nul
dir /b src-tauri\target\release\bundle\msi\*.msi 2>nul

echo.
echo Updater artifacts (for GitHub release):
dir /b src-tauri\target\release\bundle\nsis\*.nsis.zip 2>nul
dir /b src-tauri\target\release\bundle\nsis\*.nsis.zip.sig 2>nul
