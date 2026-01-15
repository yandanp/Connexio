@echo off
REM Build script for Connexio that sets up Visual Studio environment
REM Run this from a regular Windows CMD prompt

echo Setting up Visual Studio environment...

REM Try to find VS 2022 installation
set VSWHERE="C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"
if exist %VSWHERE% (
    for /f "usebackq tokens=*" %%i in (`%VSWHERE% -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do (
        set VS_PATH=%%i
    )
)

if not defined VS_PATH (
    echo ERROR: Visual Studio with C++ tools not found!
    echo Please install Visual Studio 2022 with "Desktop development with C++" workload
    exit /b 1
)

echo Found Visual Studio at: %VS_PATH%

REM Call vcvars64.bat to set up environment
call "%VS_PATH%\VC\Auxiliary\Build\vcvars64.bat" >nul

REM Verify environment is set up
where link.exe >nul 2>&1
if errorlevel 1 (
    echo ERROR: Failed to set up Visual Studio environment
    exit /b 1
)

echo Visual Studio environment configured successfully

REM Navigate to src-tauri and build
cd /d "%~dp0src-tauri"

echo Building Connexio...
cargo build

if errorlevel 1 (
    echo Build failed!
    exit /b 1
)

echo Build successful!
