Set-Location -LiteralPath 'D:\Tool AutoWhiskLozyMMO'
Write-Host "Starting Vite dev server..." -ForegroundColor Cyan
Start-Process -FilePath "node" -ArgumentList @("node_modules/vite/bin/vite.js", "--port", "3000") -WorkingDirectory 'D:\Tool AutoWhiskLozyMMO\Interface\tech-&-ai' -WindowStyle Hidden
Start-Sleep -Seconds 3
Write-Host "Vite running on http://localhost:3000" -ForegroundColor Green
Write-Host "Starting Tauri dev..." -ForegroundColor Cyan
Set-Location -LiteralPath 'D:\Tool AutoWhiskLozyMMO\src-tauri'
cargo tauri dev
