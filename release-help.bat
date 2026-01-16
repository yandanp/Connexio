@echo off
REM ================================================
REM Connexio Release Commands - Quick Reference
REM ================================================
REM
REM AUTOMATED RELEASE (Recommended):
REM   npm run release:patch   - Bug fix (0.2.3 -> 0.2.4)
REM   npm run release:minor   - New feature (0.2.3 -> 0.3.0)
REM   npm run release:major   - Breaking change (0.2.3 -> 1.0.0)
REM
REM MANUAL STEPS:
REM   1. npm run version:patch     - Bump version only
REM   2. git add . && git commit   - Commit changes
REM   3. powershell -File build-signed.ps1  - Build with signing
REM   4. Edit latest.json          - Update signature
REM   5. gh release create v0.2.4  - Create GitHub release
REM
REM ================================================

echo.
echo Connexio Release Commands
echo =========================
echo.
echo AUTOMATED RELEASE (1 command does everything):
echo   npm run release:patch   - Bug fix release
echo   npm run release:minor   - Feature release
echo   npm run release:major   - Breaking change
echo.
echo MANUAL VERSION BUMP:
echo   npm run version:patch   - 0.2.3 -^> 0.2.4
echo   npm run version:minor   - 0.2.3 -^> 0.3.0
echo   npm run version:major   - 0.2.3 -^> 1.0.0
echo.
echo BUILD WITH SIGNING:
echo   powershell -ExecutionPolicy Bypass -File build-signed.ps1
echo.
echo See RELEASE.md for full documentation.
echo.
