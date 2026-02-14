@echo off
cd /d "%~dp0Interface\tech-&-ai"
node node_modules\vite\bin\vite.js build
if errorlevel 1 (
    echo Frontend build failed!
    pause
    exit /b 1
)
echo Frontend build done!
pause
