@echo off
setlocal EnableExtensions
title GUI Editor

REM Current editor launcher.
REM Opens the self-contained DOM editor. No npm, no server, no build.

set "APP=%~dp0"
set "EDITOR=%APP%gui-editor.html"

if not exist "%EDITOR%" goto :missing

echo [GUI Editor] Opening %EDITOR%
start "" "%EDITOR%"
goto :done

:missing
echo [GUI Editor] ERROR: cannot find gui-editor.html next to this script.
echo [GUI Editor] Expected: %EDITOR%
echo.
pause

:done
endlocal
