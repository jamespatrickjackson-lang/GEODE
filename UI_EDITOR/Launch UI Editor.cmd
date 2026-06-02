@echo off
setlocal EnableExtensions
title UI Editor
REM Launcher that lives INSIDE the UI_EDITOR folder. Self-locating: it starts
REM the Vite dev server from whatever directory this .cmd file sits in, so the
REM folder can be moved or renamed without editing this script. The root-level
REM "Editor App.cmd" is a separate launcher and is not touched by this one.

set "APP=%~dp0"

echo [UI Editor] App folder: %APP%

if not exist "%APP%package.json" goto :no_pkg

pushd "%APP%" >nul
if errorlevel 1 goto :no_cd

where npm >nul 2>nul
if errorlevel 1 goto :no_npm

if not exist "node_modules" goto :install
goto :run

:install
echo [UI Editor] First run. Installing dependencies. This can take a minute.
call npm install
if errorlevel 1 goto :install_failed
goto :run

:run
echo [UI Editor] Starting Vite at http://localhost:5174/
echo [UI Editor] Browser will open shortly. Press Ctrl+C here to stop.
start "" "http://localhost:5174/"
call npm run dev
echo.
echo [UI Editor] npm run dev exited.
popd >nul
goto :hold

:no_pkg
echo [UI Editor] ERROR: cannot find package.json next to this script (%APP%).
goto :hold

:no_cd
echo [UI Editor] ERROR: failed to cd into %APP%.
goto :hold

:no_npm
echo [UI Editor] ERROR: npm is not on PATH. Install Node.js 20+ from nodejs.org first.
popd >nul
goto :hold

:install_failed
echo [UI Editor] ERROR: npm install failed. Scroll up for details.
popd >nul
goto :hold

:hold
echo.
echo [UI Editor] Press any key to close this window.
pause >nul
endlocal
