@echo off
cd /d "%~dp0Interface\tech-&-ai"
rd /s /q "node_modules\.vite" 2>nul
rd /s /q "dist" 2>nul
echo Cache cleared!
