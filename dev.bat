@echo off
echo === Starting Vite dev server ===
cd /d "%~dp0Interface\tech-&-ai"
start /B node node_modules\vite\bin\vite.js --port 3000

echo Waiting for Vite...
timeout /t 3 /nobreak > nul

echo === Starting Tauri dev ===
cd /d "%~dp0src-tauri"
cargo tauri dev
