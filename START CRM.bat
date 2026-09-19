@echo off
title FITNESS TIME CRM

cd /d "%~dp0backend"

start "FITNESS TIME CRM SERVER" cmd /k "node server.js"

timeout /t 2 /nobreak >nul

start "" "http://localhost:5000"

exit