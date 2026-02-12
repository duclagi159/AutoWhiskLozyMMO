@echo off
cd /d "D:\Tool AutoWhiskLozyMMO\Interface\tech-&-ai"

echo Building React App...
node "node_modules\vite\bin\vite.js" build

echo Cleaning old wwwroot...
if exist "D:\Tool AutoWhiskLozyMMO\ToolApp\wwwroot" rmdir /s /q "D:\Tool AutoWhiskLozyMMO\ToolApp\wwwroot"
mkdir "D:\Tool AutoWhiskLozyMMO\ToolApp\wwwroot"

echo Copying build artifacts...
xcopy "dist\*" "D:\Tool AutoWhiskLozyMMO\ToolApp\wwwroot\" /E /Y /I


echo Building C# ToolApp...
cd /d "D:\Tool AutoWhiskLozyMMO\ToolApp"
dotnet build -c Release

echo All Done!
pause
