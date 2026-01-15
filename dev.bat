@echo off
REM Development script for Connexio - starts Tauri dev server with proper VS environment
REM Run this from a regular Windows CMD prompt

echo ==================================================
echo    Connexio Development Server
echo ==================================================
echo.

REM Try to find VS 2022 installation
set VSWHERE="C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"
if exist %VSWHERE% (
    for /f "usebackq tokens=*" %%i in (`%VSWHERE% -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do (
        set VS_PATH=%%i
    )
)

if not defined VS_PATH (
    echo ERROR: Visual Studio with C++ tools not found!
    echo.
    echo Please install Visual Studio 2022 with the following:
    echo   - Desktop development with C++ workload
    echo   - Windows 10/11 SDK
    echo.
    exit /b 1
)

echo [1/3] Setting up Visual Studio environment...
call "%VS_PATH%\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1

REM Verify environment is set up
where link.exe >nul 2>&1
if errorlevel 1 (
    echo ERROR: Failed to set up Visual Studio environment
    exit /b 1
)
echo       Visual Studio environment configured!

echo [2/3] Checking dependencies...
cd /d "%~dp0"
call npm --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm not found! Please install Node.js
    exit /b 1
)
echo       Node.js and npm ready!

echo [3/3] Starting development server...
echo.
echo --------------------------------------------------
echo Tauri dev server starting...
echo Press Ctrl+C to stop
echo --------------------------------------------------
echo.

npm run tauri:dev
