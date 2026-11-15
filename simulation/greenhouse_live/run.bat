@echo off
cd /d "%~dp0"
set PY=
where py >nul 2>nul
if not errorlevel 1 set PY=py -3
if "%PY%"=="" (
  where python >nul 2>nul
  if not errorlevel 1 set PY=python
)
if "%PY%"=="" (
  echo Python 3 was not found. Install it from https://www.python.org and tick "Add to PATH".
  pause
  exit /b 1
)
start "" http://localhost:8000/
timeout /t 2 >nul
start "" http://localhost:8000/feed
%PY% server.py 8000
pause
