# =====================================================================
#  CodeLite local server
#  Serves the app on http://localhost:<port>/ so that the browser
#  treats it as a secure origin (required for folder/file access).
#  Uses a raw TCP listener -> no admin rights needed.
# =====================================================================
param(
    [string]$Root = (Join-Path $PSScriptRoot 'app'),
    [int]$StartPort = 8737,
    [int]$EndPort   = 8767
)

$ErrorActionPreference = 'Stop'

try {
    $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
    if (-not (Test-Path -LiteralPath $rootFull)) { exit 1 }
} catch { exit 1 }

# ---- find a free port -------------------------------------------------
$listener = $null
$port = 0
for ($p = $StartPort; $p -le $EndPort; $p++) {
    try {
        $l = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback, $p)
        $l.Start()
        $listener = $l
        $port = $p
        break
    } catch { }
}
if ($null -eq $listener) { exit 1 }

$portFile = Join-Path $env:TEMP 'codelite.port'
Set-Content -LiteralPath $portFile -Value $port -Encoding ascii -ErrorAction SilentlyContinue

# ---- mime types ------------------------------------------------------
$mime = @{
    '.html' = 'text/html; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.svg'  = 'image/svg+xml'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.ico'  = 'image/x-icon'
    '.woff' = 'font/woff'
    '.woff2'= 'font/woff2'
    '.ttf'  = 'font/ttf'
    '.txt'  = 'text/plain; charset=utf-8'
    '.map'  = 'application/json'
}

function Send-Bytes($stream, [int]$status, [string]$type, [byte[]]$body) {
    $reason = '200 OK'
    if ($status -eq 404) { $reason = '404 Not Found' }
    if ($status -eq 400) { $reason = '400 Bad Request' }
    $len = 0
    if ($body) { $len = $body.Length }
    $head = "HTTP/1.1 $status $reason`r`n" +
            "Content-Type: $type`r`n" +
            "Content-Length: $len`r`n" +
            "Cache-Control: no-store, no-cache, must-revalidate`r`n" +
            "Connection: close`r`n`r`n"
    $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
    $stream.Write($hb, 0, $hb.Length)
    if ($len -gt 0) { $stream.Write($body, 0, $len) }
    $stream.Flush()
}

$running = $true

while ($running) {
    try { $client = $listener.AcceptTcpClient() } catch { break }
    try {
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)

        $requestLine = $reader.ReadLine()
        if ([string]::IsNullOrWhiteSpace($requestLine)) { $client.Close(); continue }

        # drain headers
        $guard = 0
        while ($guard -lt 100) {
            $h = $reader.ReadLine()
            if ($null -eq $h) { break }
            if ($h -eq '') { break }
            $guard++
        }

        $parts = $requestLine -split ' '
        $method = $parts[0]
        $target = $parts[1]
        if ([string]::IsNullOrEmpty($target)) { $target = '/' }

        # ---- shutdown -------------------------------------------------
        if ($method -eq 'POST' -and $target -eq '/shutdown') {
            $msg = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true}')
            Send-Bytes $stream 200 'application/json' $msg
            $running = $false
            $client.Close()
            continue
        }

        $clean = ($target -split '\?')[0]
        $clean = [System.Uri]::UnescapeDataString($clean)

        if ($clean -eq '/' -or $clean -eq '') { $clean = '/index.html' }

        if ($clean -notmatch '^/[\w\-./]+$') {
            Send-Bytes $stream 400 'text/plain' ([System.Text.Encoding]::UTF8.GetBytes('bad path'))
            $client.Close(); continue
        }

        $rel = $clean.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
        $full = [System.IO.Path]::GetFullPath((Join-Path $rootFull $rel))

        if (-not $full.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
            Send-Bytes $stream 400 'text/plain' ([System.Text.Encoding]::UTF8.GetBytes('forbidden'))
            $client.Close(); continue
        }

        if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
            Send-Bytes $stream 404 'text/plain' ([System.Text.Encoding]::UTF8.GetBytes('not found'))
            $client.Close(); continue
        }

        $ext = [System.IO.Path]::GetExtension($full).ToLower()
        $type = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }

        $bytes = [System.IO.File]::ReadAllBytes($full)
        Send-Bytes $stream 200 $type $bytes
        $client.Close()
    } catch {
        try { $client.Close() } catch { }
    }
}

try { $listener.Stop() } catch { }
try { Remove-Item -LiteralPath $portFile -Force -ErrorAction SilentlyContinue } catch { }