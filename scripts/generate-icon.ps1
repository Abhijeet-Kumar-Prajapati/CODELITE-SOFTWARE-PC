# =====================================================================
#  generate-icon.ps1
#  Creates the CodeLite application icon (multi-resolution .ico)
#  and a large logo.png for the repository.
#
#  Usage:  powershell -ExecutionPolicy Bypass -File generate-icon.ps1
# =====================================================================
param(
    [string]$OutIco = (Join-Path $PSScriptRoot '..\src\build\codelite.ico'),
    [string]$OutPng = (Join-Path $PSScriptRoot '..\docs\logo.png')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function New-LogoBitmap([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear([System.Drawing.Color]::Transparent)

    # ---- rounded square background with vertical gradient ----
    $pad = [Math]::Max(1, [int]($size * 0.06))
    $w = $size - 2 * $pad
    $r = [int]($size * 0.22)

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $path.AddArc($pad, $pad, $d, $d, 180, 90)
    $path.AddArc($pad + $w - $d, $pad, $d, $d, 270, 90)
    $path.AddArc($pad + $w - $d, $pad + $w - $d, $d, $d, 0, 90)
    $path.AddArc($pad, $pad + $w - $d, $d, $d, 90, 90)
    $path.CloseFigure()

    $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point(0, $size)),
        [System.Drawing.Color]::FromArgb(255, 0, 122, 204),
        [System.Drawing.Color]::FromArgb(255, 0, 191, 168))
    $g.FillPath($grad, $path)
    $grad.Dispose()

    # ---- top-half sheen, clipped to the same rounded shape ----
    $sheenH = [int]($size * 0.5)
    $saveState = $g.Save()
    $g.SetClip($path)
    $gloss = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, $pad)),
        (New-Object System.Drawing.Point(0, ($pad + $sheenH))),
        [System.Drawing.Color]::FromArgb(40, 255, 255, 255),
        [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
    $g.FillRectangle($gloss, $pad, $pad, $w, $sheenH)
    $gloss.Dispose()
    $g.Restore($saveState)

    # ---- the "<>" mark, or "CL" when there is room ----
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $cx = $size / 2.0
    $cy = $size / 2.0

    if ($size -ge 128) {
        $font = New-Object System.Drawing.Font('Segoe UI', ($size * 0.42), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $sf = New-Object System.Drawing.StringFormat
        $sf.Alignment = [System.Drawing.StringAlignment]::Center
        $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
        $rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
        $g.DrawString('CL', $font, $brush, $rect, $sf)
        $sf.Dispose(); $font.Dispose()
    }
    else {
        # chevrons < >
        $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), ([Math]::Max(1.6, $size * 0.11))
        $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $pen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
        $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

        $lw = $size * 0.20
        $lh = $size * 0.26
        $ox = $size * 0.14
        $g.DrawLines($pen, @(
            (New-Object System.Drawing.PointF(($cx - $ox - $lw), ($cy - $lh))),
            (New-Object System.Drawing.PointF(($cx - $ox), $cy)),
            (New-Object System.Drawing.PointF(($cx - $ox - $lw), ($cy + $lh)))
        ))
        $g.DrawLines($pen, @(
            (New-Object System.Drawing.PointF(($cx + $ox + $lw), ($cy - $lh))),
            (New-Object System.Drawing.PointF(($cx + $ox), $cy)),
            (New-Object System.Drawing.PointF(($cx + $ox + $lw), ($cy + $lh)))
        ))
        # slash
        $g.DrawLine($pen, ($cx + $size * 0.06), ($cy + $lh + $size * 0.04), ($cx - $size * 0.06), ($cy - $lh - $size * 0.04))
        $pen.Dispose()
    }

    $brush.Dispose()
    $path.Dispose()
    $g.Dispose()
    return $bmp
}

function Get-PngBytes([System.Drawing.Bitmap]$bmp) {
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray()
    $ms.Dispose()
    return ,$bytes
}

# ---------------- build the .ico ----------------
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$images = @()
foreach ($s in $sizes) {
    $bmp = New-LogoBitmap $s
    $images += , [pscustomobject]@{ Size = $s; Data = (Get-PngBytes $bmp) }
    $bmp.Dispose()
}

$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)
try {
    # ICONDIR
    $bw.Write([UInt16]0)              # reserved
    $bw.Write([UInt16]1)              # type = icon
    $bw.Write([UInt16]$images.Count)

    $offset = 6 + (16 * $images.Count)
    foreach ($img in $images) {
        $dim = if ($img.Size -ge 256) { 0 } else { $img.Size }
        $bw.Write([Byte]$dim)          # width
        $bw.Write([Byte]$dim)          # height
        $bw.Write([Byte]0)             # palette
        $bw.Write([Byte]0)             # reserved
        $bw.Write([UInt16]1)           # colour planes
        $bw.Write([UInt16]32)          # bits per pixel
        $bw.Write([UInt32]$img.Data.Length)
        $bw.Write([UInt32]$offset)
        $offset += $img.Data.Length
    }
    foreach ($img in $images) { $bw.Write([byte[]]$img.Data) }
    $bw.Flush()

    $outIcoFull = [System.IO.Path]::GetFullPath($OutIco)
    [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($outIcoFull)) | Out-Null
    [System.IO.File]::WriteAllBytes($outIcoFull, $ms.ToArray())
    Write-Host ("ICO written : {0} ({1} bytes, {2} sizes)" -f $outIcoFull, $ms.Length, $images.Count)
}
finally { $bw.Dispose(); $ms.Dispose() }

# ---------------- big logo.png for the repo ----------------
$big = New-LogoBitmap 512
$outPngFull = [System.IO.Path]::GetFullPath($OutPng)
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($outPngFull)) | Out-Null
$big.Save($outPngFull, [System.Drawing.Imaging.ImageFormat]::Png)
$big.Dispose()
Write-Host ("PNG written : {0}" -f $outPngFull)