# connexio-shell-integration (PowerShell)
# Sets UTF-8 encoding and sources user profile.

if ($global:__CONNEXIO_HOOKS_LOADED) { return }
$global:__CONNEXIO_HOOKS_LOADED = $true

# Force UTF-8 encoding so Nerd Font / Unicode glyphs render correctly
try {
    [Console]::InputEncoding  = [System.Text.UTF8Encoding]::new($false)
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $global:OutputEncoding    = [System.Text.UTF8Encoding]::new($false)
} catch {}

# Source user's normal profile (oh-my-posh, starship, aliases, etc.)
# Use $PROFILE which PowerShell always resolves correctly regardless of OneDrive
if ($PROFILE -and (Test-Path $PROFILE)) {
    . $PROFILE
}
