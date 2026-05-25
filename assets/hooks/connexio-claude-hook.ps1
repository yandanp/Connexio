# Connexio notification hook for Claude Code
# Sends notification to Connexio when Claude finishes a task
# Usage: Called by Claude Code hooks system on "Stop" event

param(
    [string]$Event = "stop"
)

$port = $env:CONNEXIO_NOTIFICATION_PORT
if (-not $port) { exit 0 }

$input = $null
try { $input = [Console]::In.ReadToEnd() } catch {}

$body = "Session completed"
if ($input) {
    $match = [regex]::Match($input, '"last_assistant_message":"([^"]*)"')
    if ($match.Success) {
        $body = $match.Groups[1].Value
        if ($body.Length -gt 200) { $body = $body.Substring(0, 200) }
    }
}

$title = "Claude Code"
if ($Event -eq "notification") {
    $body = "Needs attention"
}

$payload = @{
    provider = "claude"
    title = $title
    body = $body
    projectId = $env:CONNEXIO_PROJECT_ID
    projectName = $env:CONNEXIO_PROJECT_NAME
    tabId = $env:CONNEXIO_TAB_ID
    tabLabel = $env:CONNEXIO_TAB_LABEL
    terminalId = $env:CONNEXIO_TERMINAL_ID
}

$message = $payload | ConvertTo-Json -Compress

try {
    $client = New-Object System.Net.Sockets.TcpClient("127.0.0.1", [int]$port)
    $stream = $client.GetStream()
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($message)
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Close()
    $client.Close()
} catch {
    # Silently fail — Connexio may not be running
}
