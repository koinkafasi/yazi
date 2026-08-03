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
    # Downloaded archives carry a Mark-of-the-Web that Expand-Archive copies onto
    # every extracted file; clearing it avoids a needless SmartScreen prompt.
    Get-ChildItem $Target -Recurse -File | Unblock-File -ErrorAction SilentlyContinue
} else {
    if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
        throw "No release binary found and cargo is not installed. Install Rust from https://rustup.rs and rerun."
    }
    Warn "no prebuilt release found, building from source"
    Warn "a source build needs the MSVC toolchain AND the Windows SDK; it also fails if"
    Warn "a Unix 'link' (Git Bash, MSYS, Cygwin) shadows MSVC's link.exe on PATH"

    # Detect if GNU link (Git Bash / MSYS / Cygwin) shadows MSVC link.exe
    $linkCmd = Get-Command link.exe -ErrorAction SilentlyContinue
    $linkPath = if ($linkCmd) { $linkCmd.Source } else { $null }
    if ($linkPath -and $linkPath -match 'Git|msys|mingw|cygwin') {
        Warn "GNU link found at $linkPath — this shadows MSVC link.exe"
        Warn "Build will likely fail. Options:"
        Write-Host "    1) Remove Git Bash / MSYS from PATH temporarily"
        Write-Host "    2) Build on Linux instead (Arch): cargo build --release --bin imlec-typer"
        Write-Host "    3) Wait for a prebuilt release (.exe)"
    }

    # Download source zip (no git required)
    $srcRoot = Join-Path $env:TEMP ("imlec-typer-src-" + [Guid]::NewGuid().ToString().Substring(0, 8))
    New-Item -ItemType Directory -Force -Path $srcRoot | Out-Null

    $zip = Join-Path $env:TEMP 'imlec-typer-main.zip'
    Info "downloading source archive"
    Invoke-WebRequest "https://github.com/$Repo/archive/refs/heads/main.zip" -OutFile $zip
    Expand-Archive -Path $zip -DestinationPath $srcRoot -Force
    Remove-Item $zip -Force

    $src = Join-Path $srcRoot 'yazi-main'
    Push-Location $src
    try {
        cargo build --release --bin imlec-typer 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "cargo build failed. See above for the error. If link.exe failed with 'extra operand', remove Git Bash/MSYS from PATH and retry."
        }
        Copy-Item 'target/release/imlec-typer.exe' $Target -Force
        Copy-Item 'config/default.toml' $Target -Force
    } finally {
        Pop-Location
    }
}

$exe = Join-Path $Target 'imlec-typer.exe'
if (-not (Test-Path $exe)) { throw "imlec-typer.exe was not produced at $exe" }

# Autostart via a Startup folder shortcut. Reversible: delete the .lnk.
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
