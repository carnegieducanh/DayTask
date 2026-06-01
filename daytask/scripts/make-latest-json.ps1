# Script tạo latest.json cho Tauri auto-update GitHub Release
# Chạy sau khi build xong: .\scripts\make-latest-json.ps1 -Version "0.2.0"

param(
    [Parameter(Mandatory=$true)]
    [string]$Version
)

$bundleDir = "src-tauri\target\release\bundle"
$nsisDir   = "$bundleDir\nsis"
$exeName   = "Atomic_${Version}_x64-setup.exe"
$sigFile   = "$nsisDir\${exeName}.sig"
$exeFile   = "$nsisDir\$exeName"

if (-not (Test-Path $sigFile)) {
    Write-Error "Signature file not found: $sigFile"
    exit 1
}

$sig = Get-Content $sigFile -Raw

$latestJson = @{
    version = "v$Version"
    notes   = "Atomic v$Version"
    pub_date = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    platforms = @{
        "windows-x86_64" = @{
            signature = $sig.Trim()
            url       = "https://github.com/carnegieducanh/DayTask/releases/download/v${Version}/${exeName}"
        }
    }
} | ConvertTo-Json -Depth 5

$latestJson | Out-File -FilePath "latest.json" -Encoding utf8
Write-Host "Created latest.json for v$Version"
Write-Host "Upload these files to GitHub Release v${Version}:"
Write-Host "  - $exeFile"
Write-Host "  - $sigFile"
Write-Host "  - latest.json"
