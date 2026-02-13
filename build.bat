@echo off
echo === Building frontend ===
cd /d "%~dp0Interface\tech-&-ai"
node node_modules\vite\bin\vite.js build
if errorlevel 1 (
    echo Frontend build failed!
    pause
    exit /b 1
)

echo === Building Tauri app ===
cd /d "%~dp0src-tauri"
set CARGO_BUILD_JOBS=1
cargo tauri build
pause
