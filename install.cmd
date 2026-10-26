@echo off
setlocal
chcp 65001 >nul
set "LMRU_ACTION=apply"
call "%~dp0run.cmd" %*
exit /b %errorlevel%
