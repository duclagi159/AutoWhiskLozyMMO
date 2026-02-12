param([string]$version)

if ([string]::IsNullOrWhiteSpace($version)) {
    $version = Read-Host "Enter new version (e.g., 2.0.1)"
}

$token = "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"
$repo = "duclagi159/AutoWhiskLozyMMO"
$projectDir = "d:\Tool AutoWhiskLozyMMO\ToolApp"
$zipName = "ToolApp-win-x64.zip"

Write-Host "Updating version in ToolApp.csproj..."
$csprojPath = "$projectDir\ToolApp.csproj"
$content = Get-Content $csprojPath
$content = $content -replace '<Version>.*?</Version>', "<Version>$version</Version>"
Set-Content $csprojPath $content

Write-Host "Building project..."
dotnet build "$projectDir" -c Release

Write-Host "Zipping output..."
$binDir = "$projectDir\bin\Release\net8.0-windows"
$zipPath = "$projectDir\$zipName"
if (Test-Path $zipPath) { Remove-Item $zipPath }
Compress-Archive -Path "$binDir\*" -DestinationPath $zipPath

Write-Host "Creating GitHub Release $version..."
$body = @{
    tag_name         = "v$version"
    target_commitish = "main"
    name             = "v$version"
    body             = "Release v$version"
    draft            = $false
    prerelease       = $false
} | ConvertTo-Json

$releaseUrl = "https://api.github.com/repos/$repo/releases"
$headers = @{
    "Authorization" = "Bearer $token"
    "Accept"        = "application/vnd.github+json"
    "User-Agent"    = "ToolApp-Publisher"
}

try {
    $response = Invoke-RestMethod -Uri $releaseUrl -Method Post -Headers $headers -Body $body -ContentType "application/json"
    $uploadUrl = $response.upload_url -replace '{.*}', ''
    
    Write-Host "Uploading asset to $uploadUrl..."
    $assetUrl = "$uploadUrl`?name=$zipName"
    
    # Use Invoke-RestMethod with byte array for reliable upload
    $fileBytes = [System.IO.File]::ReadAllBytes($zipPath)
    $uploadHeaders = @{
        "Authorization" = "Bearer $token"
        "Content-Type"  = "application/zip"
        "User-Agent"    = "ToolApp-Publisher"
    }
    $uploadResult = Invoke-RestMethod -Uri $assetUrl -Method Post -Headers $uploadHeaders -Body $fileBytes -ContentType "application/zip"
    
    if ($uploadResult.state -eq "uploaded") {
        Write-Host "Release $version published successfully! Asset: $($uploadResult.name) ($($uploadResult.size) bytes)"
    }
    else {
        Write-Error "Asset upload may have failed. State: $($uploadResult.state)"
    }
}
catch {
    Write-Error "Failed to publish release. Error: $_"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host $reader.ReadToEnd()
    }
}

Read-Host "Press Enter to exit"
