# imlec-typer installer for Windows.
#   irm https://raw.githubusercontent.com/koinkafasi/yazi/main/install.ps1 | iex
$ErrorActionPreference = 'Stop'

$Repo    = 'koinkafasi/yazi'
$Target  = Join-Path $env:LOCALAPPDATA 'imlec-typer'
$Startup = [Environment]::GetFolderPath('Startup')

function Info($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Warn($msg) { Write-Host "warn $msg" -ForegroundColor Yellow }

Info "installing imlec-typer to $Target"
New-Item -ItemType Directory -Force -Path $Target | Out-Null

$asset = $null
try {
    $release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest"
    $asset = $release.assets | Where-Object { $_.name -eq 'imlec-typer-x86_64-windows.zip' } | Select-Object -First 1
} catch {
    Warn "could not reach the GitHub releases API: $($_.Exception.Message)"
}

if ($asset) {
    $zip = Join-Path $env:TEMP 'imlec-typer.zip'
    Info "downloading $($asset.browser_download_url)"
    Invoke-WebRequest $asset.browser_download_url -OutFile $zip
    Expand-Archive -Path $zip -DestinationPath $Target -Force
    Remove-Item $zip -Force
    Get-ChildItem $Target -Recurse -File | Unblock-File -ErrorAction SilentlyContinue
} else {
    if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
        throw "No release binary found and cargo is not installed. Install Rust from https://rustup.rs and rerun."
    }
    Warn "no prebuilt release found, building from source"
    Warn "a source build needs the MSVC toolchain AND the Windows SDK"
    $src = Join-Path $env:TEMP 'imlec-typer-src'
    if (Test-Path $src) { Remove-Item $src -Recurse -Force }
    git clone --depth 1 "https://github.com/$Repo.git" $src
    Push-Location $src
    try {
        cargo build --release --bin imlec-typer
        Copy-Item 'target/release/imlec-typer.exe' $Target -Force
        Copy-Item 'config/default.toml' $Target -Force
    } finally {
        Pop-Location
    }
}

$exe = Join-Path $Target 'imlec-typer.exe'
if (-not (Test-Path $exe)) { throw "imlec-typer.exe was not produced at $exe" }

# Autostart via Startup folder shortcut
$shortcut = Join-Path $Startup 'imlec-typer.lnk'
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($shortcut)
$link.TargetPath = $exe
$link.WorkingDirectory = $Target
$link.WindowStyle = 7
$link.Description = 'imlec-typer particle cursor overlay'
$link.Save()
Info "autostart shortcut written to $shortcut"

Write-Host ""
Write-Host "  imlec-typer installed."
Write-Host ""
Write-Host "    $exe                          run it"
Write-Host "    $exe --print-config-path      where the config lives"
Write-Host "    $exe --reset-config           restore the commented defaults"
Write-Host ""
Write-Host "  Right-click the tray icon to toggle effects, open the config or exit."
Write-Host "  Remove autostart by deleting $shortcut"
Write-Host ""

try {
    Start-Process $exe -ErrorAction Stop
} catch {
    Warn "Windows refused to launch imlec-typer: $($_.Exception.Message)"
    $sac = try {
        (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy' `
            -Name VerifiedAndReputablePolicyState -ErrorAction Stop).VerifiedAndReputablePolicyState
    } catch { $null }
    if ($sac -eq 1) {
        Write-Host ""
        Write-Host "  Smart App Control is in enforcement mode. It only runs signed"
        Write-Host "  applications that Microsoft already considers reputable, so it"
        Write-Host "  blocks imlec-typer until the release binaries are code signed."
        Write-Host ""
        Write-Host "  Settings > Privacy & security > Windows Security >"
        Write-Host "  App & browser control > Smart App Control settings"
        Write-Host ""
        Write-Host "  Turning it off is IRREVERSIBLE: re-enabling requires reinstalling"
        Write-Host "  Windows. Read https://github.com/koinkafasi/yazi#windows-imzalama"
        Write-Host "  before deciding."
    }
}
