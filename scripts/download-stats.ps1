# Connexio Download Stats Notifier
# Run manually or schedule with Windows Task Scheduler
#
# Setup Telegram:
# 1. Create bot via @BotFather, get token
# 2. Get your chat ID from https://api.telegram.org/bot<TOKEN>/getUpdates
# 3. Set environment variables or edit below:

param(
    [string]$TelegramToken = $env:TELEGRAM_BOT_TOKEN,
    [string]$TelegramChatId = $env:TELEGRAM_CHAT_ID
)

$ErrorActionPreference = "Stop"

# Check Telegram credentials
if (-not $TelegramToken -or -not $TelegramChatId) {
    Write-Host "ERROR: Telegram credentials not set!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Option 1: Set environment variables:"
    Write-Host '  $env:TELEGRAM_BOT_TOKEN = "your-bot-token"'
    Write-Host '  $env:TELEGRAM_CHAT_ID = "your-chat-id"'
    Write-Host ""
    Write-Host "Option 2: Pass as parameters:"
    Write-Host '  .\download-stats.ps1 -TelegramToken "token" -TelegramChatId "chatid"'
    exit 1
}

Write-Host "Fetching Connexio download stats..." -ForegroundColor Cyan

# Fetch release data from GitHub API
$releases = Invoke-RestMethod -Uri "https://api.github.com/repos/yandanp/Connexio/releases" -Headers @{
    "User-Agent" = "Connexio-Stats-Script"
}

# Calculate total downloads
$totalDownloads = 0
foreach ($release in $releases) {
    foreach ($asset in $release.assets) {
        $totalDownloads += $asset.download_count
    }
}

# Get latest release info
$latest = $releases[0]
$latestVersion = $latest.tag_name
$latestDate = ([DateTime]$latest.published_at).ToString("yyyy-MM-dd")
$latestDownloads = ($latest.assets | Measure-Object -Property download_count -Sum).Sum

# Get installer downloads only (exclude .sig files)
$installerDownloads = $latest.assets | Where-Object { $_.name -match "\.(exe|msi)$" -and $_.name -notmatch "\.sig$" }

Write-Host ""
Write-Host "=== Connexio Download Stats ===" -ForegroundColor Green
Write-Host "Total Downloads: $totalDownloads"
Write-Host "Latest Version: $latestVersion ($latestDate)"
Write-Host "Latest Downloads: $latestDownloads"
Write-Host ""
Write-Host "Breakdown:"
foreach ($asset in $installerDownloads) {
    Write-Host "  $($asset.name): $($asset.download_count)"
}

# Load previous stats
$cacheFile = Join-Path $PSScriptRoot ".download-stats-cache.json"
$previousTotal = 0
if (Test-Path $cacheFile) {
    $cache = Get-Content $cacheFile | ConvertFrom-Json
    $previousTotal = $cache.total
}

$newDownloads = $totalDownloads - $previousTotal

# Save current stats
@{ total = $totalDownloads; timestamp = (Get-Date).ToString("o") } | ConvertTo-Json | Set-Content $cacheFile

# Build Telegram message
$message = @"
📊 *Connexio Download Stats*
━━━━━━━━━━━━━━━━━━━━━━
📦 *Total Downloads:* $totalDownloads
🆕 *New Downloads:* +$newDownloads

🏷️ *Latest Release:* $latestVersion
📅 *Released:* $latestDate
⬇️ *Downloads:* $latestDownloads

🔗 [View Releases](https://github.com/yandanp/Connexio/releases)
"@

# Send to Telegram
Write-Host ""
Write-Host "Sending to Telegram..." -ForegroundColor Cyan

$telegramUrl = "https://api.telegram.org/bot$TelegramToken/sendMessage"
$body = @{
    chat_id = $TelegramChatId
    text = $message
    parse_mode = "Markdown"
    disable_web_page_preview = $true
}

try {
    $response = Invoke-RestMethod -Uri $telegramUrl -Method Post -Body $body
    if ($response.ok) {
        Write-Host "✅ Notification sent successfully!" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Failed to send Telegram notification: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
