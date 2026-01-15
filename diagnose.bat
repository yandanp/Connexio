@echo off
REM Diagnostic script for Connexio build environment
REM Run this from a regular Windows CMD prompt to check your setup

echo ==================================================
echo    Connexio Build Environment Diagnostics
echo ==================================================
echo.

REM Check Visual Studio
echo [1/5] Checking Visual Studio installation...
set VSWHERE="C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"
if exist %VSWHERE% (
    for /f "usebackq tokens=*" %%i in (`%VSWHERE% -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do (
        set VS_PATH=%%i
    )
)

if defined VS_PATH (
    echo       [OK] Visual Studio found: %VS_PATH%
) else (
    echo       [ERROR] Visual Studio with C++ tools NOT FOUND!
    echo.
    echo       FIX: Install Visual Studio 2022 with "Desktop development with C++" workload
    echo       Download: https://visualstudio.microsoft.com/downloads/
    goto :end
)

REM Setup VS environment
echo.
echo [2/5] Setting up Visual Studio environment...
call "%VS_PATH%\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1

REM Check MSVC linker
echo.
echo [3/5] Checking MSVC linker...
where link.exe >nul 2>&1
if errorlevel 1 (
    echo       [ERROR] MSVC link.exe not found in PATH after vcvars64.bat
    goto :end
)
for /f "tokens=*" %%i in ('where link.exe') do (
    echo       [OK] Link.exe: %%i
    goto :check_sdk
)

:check_sdk
REM Check Windows SDK
echo.
echo [4/5] Checking Windows SDK...
if not defined LIB (
    echo       [ERROR] LIB environment variable not set!
    echo       This means vcvars64.bat failed to configure properly.
    goto :sdk_fix
)

echo       LIB paths:
for %%p in ("%LIB:;=" "%") do (
    if exist %%p (
        echo         [OK] %%~p
    ) else (
        echo         [MISSING] %%~p
    )
)

REM Check for kernel32.lib specifically
set KERNEL32_FOUND=0
for %%p in ("%LIB:;=" "%") do (
    if exist "%%~p\kernel32.lib" (
        set KERNEL32_FOUND=1
        echo.
        echo       [OK] kernel32.lib found in: %%~p
    )
)

if %KERNEL32_FOUND%==0 (
    echo.
    echo       [ERROR] kernel32.lib NOT FOUND in any LIB path!
    goto :sdk_fix
)

REM Check Rust
echo.
echo [5/5] Checking Rust installation...
where rustc >nul 2>&1
if errorlevel 1 (
    echo       [ERROR] Rust not found!
    echo       FIX: Install from https://rustup.rs/
    goto :end
)
for /f "tokens=*" %%i in ('rustc --version') do echo       [OK] %%i
for /f "tokens=*" %%i in ('cargo --version') do echo       [OK] %%i

echo.
echo ==================================================
echo    All checks passed! Your environment is ready.
echo ==================================================
echo.
echo Run 'dev.bat' to start the development server.
goto :end

:sdk_fix
echo.
echo ==================================================
echo    WINDOWS SDK MISSING - INSTALLATION REQUIRED
echo ==================================================
echo.
echo The Windows SDK is required to build Rust applications on Windows.
echo.
echo Option 1: Install via Visual Studio Installer
echo   1. Open "Visual Studio Installer"
echo   2. Click "Modify" on your Visual Studio installation
echo   3. Go to "Individual components" tab
echo   4. Search for "Windows 10 SDK" or "Windows 11 SDK"
echo   5. Check the latest version (e.g., "Windows 11 SDK 10.0.22621.0")
echo   6. Click "Modify" to install
echo.
echo Option 2: Standalone SDK Download
echo   Download from: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/
echo.
echo After installation, close this window and run diagnose.bat again.
echo.

:end
pause
