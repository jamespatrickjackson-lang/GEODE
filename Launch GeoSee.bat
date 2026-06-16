@echo off
rem Human-facing launcher. Agents should not run this file because it force-kills
rem any process listening on its configured app port.
setlocal

cd /d "%~dp0"
set "APP_PORT=5194"
set "APP_URL=http://127.0.0.1:%APP_PORT%/"

echo Starting GeoSee...

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is required but was not found.
  echo Install Node.js from https://nodejs.org/ and run this launcher again.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo npm is required but was not found.
  echo Reinstall Node.js with npm enabled, then run this launcher again.
  echo.
  pause
  exit /b 1
)

echo Checking for existing server on port %APP_PORT%...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%APP_PORT% .*LISTENING"') do (
  echo Found process listening on port %APP_PORT%: PID %%P
  taskkill /PID %%P /F >nul 2>nul
)

echo Waiting for port %APP_PORT% to free up...
:waitPort
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing '%APP_URL%' -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  echo Another process is still using %APP_URL%. Waiting...
  timeout /t 1 /nobreak >nul
  goto waitPort
)

if not exist "node_modules\" (
  echo Installing project dependencies. This can take a few minutes the first time...
  call npm install
  if errorlevel 1 (
    echo.
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

echo Opening GeoSee at %APP_URL%
start "" "%APP_URL%"

echo.
echo Keep this window open while using GeoSee.
echo Press Ctrl+C in this window to stop the app.
echo.

call npm run dev -- --host 127.0.0.1 --port %APP_PORT% --strictPort

echo.
echo GeoSee has stopped.
pause
