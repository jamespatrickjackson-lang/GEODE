@echo off
setlocal EnableExtensions
title Package Workbench (paused)

REM This starts the older React/Vite package workbench.
REM It is kept for inspection, but it is not the current GUI Editor target.
REM The current editor is gui-editor.html, opened by Launch UI Editor.cmd.

set "APP=%~dp0"

echo [Package Workbench] This is the paused package/schema workbench.
echo [Package Workbench] Current editor work should use gui-editor.html instead.
echo.
choice /M "Start the paused package workbench anyway"
if errorlevel 2 goto :done

if not exist "%APP%package.json" goto :no_pkg

pushd "%APP%" >nul
if errorlevel 1 goto :no_cd

where npm >nul 2>nul
if errorlevel 1 goto :no_npm

if not exist "node_modules\.bin\vite.cmd" (
  echo [Package Workbench] Installing dependencies.
  call npm install
  if errorlevel 1 goto :install_failed
)

echo [Package Workbench] Starting Vite at http://127.0.0.1:5174/
start "" "http://127.0.0.1:5174/"
call npm run dev
popd >nul
goto :done

:no_pkg
echo [Package Workbench] ERROR: cannot find package.json next to this script.
goto :hold

:no_cd
echo [Package Workbench] ERROR: failed to cd into %APP%.
goto :hold

:no_npm
echo [Package Workbench] ERROR: npm is not on PATH. Install Node.js 20+ first.
popd >nul
goto :hold

:install_failed
echo [Package Workbench] ERROR: npm install failed. Scroll up for details.
popd >nul
goto :hold

:hold
echo.
pause

:done
endlocal
