Add-Type -AssemblyName System.Drawing

$src = "D:\Tool AutoWhiskLozyMMO\src-tauri\target\logo.jpg"
$dst = "D:\Tool AutoWhiskLozyMMO\src-tauri\target\logo_sq.png"

if (-not (Test-Path $src)) {
    Write-Host "File not found: $src"
    exit 1
}

$bmp = [System.Drawing.Bitmap]::new($src)
$size = [Math]::Min($bmp.Width, $bmp.Height)
$sq = [System.Drawing.Bitmap]::new($size, $size)
$g = [System.Drawing.Graphics]::FromImage($sq)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$srcRect = [System.Drawing.Rectangle]::new(([int](($bmp.Width - $size) / 2)), ([int](($bmp.Height - $size) / 2)), $size, $size)
$dstRect = [System.Drawing.Rectangle]::new(0, 0, $size, $size)
$g.DrawImage($bmp, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$sq.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
$sq.Dispose()
$bmp.Dispose()
Write-Host "Square PNG created: $dst"
