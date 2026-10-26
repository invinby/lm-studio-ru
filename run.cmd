@echo off
setlocal
if not defined LMRU_ACTION set "LMRU_ACTION=status"
set "LMRU_NODE=%LOCALAPPDATA%\Programs\LM Studio\resources\app\.webpack\bin\node.exe"
if exist "%LMRU_NODE%" goto run
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Install Node.js 22+ from https://nodejs.org/ or use LM Studio's bundled node.exe.
  pause
  exit /b 1
)
set "LMRU_NODE=node.exe"
:run
"%LMRU_NODE%" "%~dp0patch.cjs" %LMRU_ACTION% %*
set "LMRU_RESULT=%errorlevel%"
echo.
pause
exit /b %LMRU_RESULT%
