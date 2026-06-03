@echo off
REM Opens the self-contained GUI Editor in your default browser.
REM No server, no build, no npm -- it's a single HTML file using localStorage.
start "" "%~dp0gui-editor.html"
