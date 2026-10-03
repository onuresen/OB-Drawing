@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if errorlevel 1 goto use_python

start "" "http://localhost:8765"
py serve.py
goto end

:use_python
start "" "http://localhost:8765"
python serve.py

:end
endlocal
