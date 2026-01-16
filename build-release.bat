@echo off
REM Connexio Build Script with Updater Signing
REM This script sets the required environment variables for signing updates

echo Reading signing key...
set /p TAURI_SIGNING_PRIVATE_KEY=<.tauri-key
set TAURI_SIGNING_PRIVATE_KEY_PASSWORD=

echo Building Connexio with updater signing...
echo.

REM Full build (both NSIS and MSI)
call npm run tauri:build
if %ERRORLEVEL% neq 0 (
    echo Build failed!
    exit /b 1
)

echo.
echo ========================================
echo Build complete!
echo ========================================
echo.
echo Installers:
dir /b src-tauri\target\release\bundle\nsis\*.exe 2>nul
dir /b src-tauri\target\release\bundle\msi\*.msi 2>nul
echo.
echo Signatures:
dir /b src-tauri\target\release\bundle\nsis\*.sig 2>nul
dir /b src-tauri\target\release\bundle\msi\*.sig 2>nul
echo.
