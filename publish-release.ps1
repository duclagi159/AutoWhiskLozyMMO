param(
    [Parameter(Mandatory = $true)][string]$Version,
    [string]$Description = "AutoWhisk Update"
)

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$REPO = "duclagi159/AutoWhiskLozyMMO"
$EXE_PATH = "$ROOT\src-tauri\target\release\autowhisk.exe"
$TEMP_EXE = "$ROOT\autowhisk_upload.exe"

Write-Host "`n=== AutoWhisk Release v$Version ===" -ForegroundColor Cyan

$cred = "protocol=https`nhost=github.com" | git credential fill 2>$null
$token = ($cred | Where-Object { $_ -match "^password=" }) -replace "^password=", ""
if (-not $token) {
    Write-Host "Git credential khong tim thay. Hay dang nhap git truoc." -ForegroundColor Red
    exit 1
}
Write-Host "[1/6] Git credential OK" -ForegroundColor Green

Write-Host "[2/6] Building frontend..." -ForegroundColor Yellow
Set-Location -LiteralPath "$ROOT\Interface\tech-&-ai"
node node_modules/vite/bin/vite.js build --outDir "../../frontend-dist" --emptyOutDir
if ($LASTEXITCODE -ne 0) { Write-Host "Frontend build FAILED" -ForegroundColor Red; exit 1 }
Write-Host "Frontend build OK" -ForegroundColor Green

Write-Host "[3/6] Building release exe..." -ForegroundColor Yellow
Set-Location -LiteralPath "$ROOT\src-tauri"
cargo build --release
if ($LASTEXITCODE -ne 0) { Write-Host "Cargo build FAILED" -ForegroundColor Red; exit 1 }
Write-Host "Release build OK" -ForegroundColor Green

Write-Host "[4/6] Git commit & push..." -ForegroundColor Yellow
Set-Location -LiteralPath $ROOT
git add -A
git commit -m "v$Version`: $Description" --allow-empty
git tag -a "v$Version" -m "v$Version`: $Description" -f
git push origin main
git push origin "v$Version" -f
Write-Host "Git push OK" -ForegroundColor Green

Write-Host "[5/6] Creating GitHub release..." -ForegroundColor Yellow
$headers = @{ Authorization = "token $token"; Accept = "application/vnd.github+json" }

$existing = $null
try { $existing = Invoke-RestMethod -Uri "https://api.github.com/repos/$REPO/releases/tags/v$Version" -Headers $headers -ErrorAction SilentlyContinue } catch {}
if ($existing) {
    foreach ($asset in $existing.assets) {
        Invoke-RestMethod -Uri $asset.url -Method Delete -Headers $headers | Out-Null
    }
    Invoke-RestMethod -Uri $existing.url -Method Delete -Headers $headers | Out-Null
    Write-Host "Deleted old release v$Version" -ForegroundColor DarkYellow
}

$releaseBody = @{
    tag_name   = "v$Version"
    name       = "v$Version - $Description"
    body       = $Description
    draft      = $false
    prerelease = $false
} | ConvertTo-Json

$release = Invoke-RestMethod -Uri "https://api.github.com/repos/$REPO/releases" -Method Post -Headers $headers -Body $releaseBody -ContentType "application/json"
Write-Host "Release created: $($release.html_url)" -ForegroundColor Green

Write-Host "[6/6] Uploading exe..." -ForegroundColor Yellow
Copy-Item -LiteralPath $EXE_PATH -Destination $TEMP_EXE -Force
$uploadHeaders = @{ Authorization = "token $token"; Accept = "application/vnd.github+json"; "Content-Type" = "application/octet-stream" }
$uploadUrl = "https://uploads.github.com/repos/$REPO/releases/$($release.id)/assets?name=autowhisk.exe"
$result = Invoke-RestMethod -Uri $uploadUrl -Method Post -Headers $uploadHeaders -InFile $TEMP_EXE
Remove-Item -LiteralPath $TEMP_EXE -Force -ErrorAction SilentlyContinue
Write-Host "Upload OK: $($result.browser_download_url)" -ForegroundColor Green

Write-Host "`n=== DONE! Release v$Version published ===" -ForegroundColor Cyan
Write-Host "URL: $($release.html_url)" -ForegroundColor White
