@echo off
setlocal EnableExtensions
title Editor App
set "ROOT=%~dp0"
set "APP=%ROOT%UI_EDITOR"

echo [Editor App] Root: %ROOT%
echo [Editor App] App:  %APP%

if not exist "%APP%\package.json" goto :no_pkg

pushd "%APP%" >nul
if errorlevel 1 goto :no_cd

where npm >nul 2>nul
if errorlevel 1 goto :no_npm

if not exist "node_modules" goto :install
goto :run

:install
echo [Editor App] First run. Installing dependencies. This can take a minute.
call npm install
if errorlevel 1 goto :install_failed
goto :run

:run
echo [Editor App] Starting Vite at http://localhost:5174/
echo [Editor App] Browser will open shortly. Press Ctrl+C here to stop.
start "" "http://localhost:5174/"
call npm run dev
echo.
echo [Editor App] npm run dev exited.
popd >nul
goto :hold

:no_pkg
echo [Editor App] ERROR: cannot find UI_EDITOR\package.json under %APP%.
goto :hold

:no_cd
echo [Editor App] ERROR: failed to cd into %APP%.
goto :hold

:no_npm
echo [Editor App] ERROR: npm is not on PATH. Install Node.js 20+ from nodejs.org first.
popd >nul
goto :hold

:install_failed
echo [Editor App] ERROR: npm install failed. Scroll up for details.
popd >nul
goto :hold

:hold
echo.
echo [Editor App] Press any key to close this window.
pause >nul
endlocal
