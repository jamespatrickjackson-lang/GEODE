@echo off
REM Opens the GUI Editor (the working single-file design tool) in your browser.
REM No server, no npm, no build -- it's one self-contained HTML using localStorage.
REM (The old Vite/React app this used to launch is gone; this is the real editor.)
start "" "%~dp0gui-editor.html"
