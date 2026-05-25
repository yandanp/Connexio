use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

// Discord Application ID — create one at https://discord.com/developers/applications
// Using a placeholder; replace with actual Connexio app ID
const DISCORD_APP_ID: &str = "1506868392668168232";

pub struct DiscordPresenceState {
    client: Mutex<Option<DiscordIpcClient>>,
    enabled: Mutex<bool>,
    start_time: Mutex<i64>,
}

impl DiscordPresenceState {
    pub fn new() -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        Self {
            client: Mutex::new(None),
            enabled: Mutex::new(false),
            start_time: Mutex::new(now),
        }
    }
}

#[tauri::command]
pub fn discord_presence_connect(state: tauri::State<'_, DiscordPresenceState>) -> Result<bool, String> {
    let mut client_lock = state.client.lock().map_err(|e| e.to_string())?;
    let mut enabled_lock = state.enabled.lock().map_err(|e| e.to_string())?;

    // Already connected
    if client_lock.is_some() && *enabled_lock {
        return Ok(true);
    }

    let mut client = DiscordIpcClient::new(DISCORD_APP_ID);

    match client.connect() {
        Ok(_) => {
            // Reset start time on connect
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64;
            *state.start_time.lock().map_err(|e| e.to_string())? = now;

            *client_lock = Some(client);
            *enabled_lock = true;
            Ok(true)
        }
        Err(e) => {
            Err(format!("Failed to connect to Discord: {}. Is Discord running?", e))
        }
    }
}

#[tauri::command]
pub fn discord_presence_disconnect(state: tauri::State<'_, DiscordPresenceState>) -> Result<bool, String> {
    let mut client_lock = state.client.lock().map_err(|e| e.to_string())?;
    let mut enabled_lock = state.enabled.lock().map_err(|e| e.to_string())?;

    if let Some(ref mut client) = *client_lock {
        let _ = client.close();
    }

    *client_lock = None;
    *enabled_lock = false;
    Ok(true)
}

#[tauri::command]
pub fn discord_presence_update(
    state: tauri::State<'_, DiscordPresenceState>,
    details: String,
    status: Option<String>,
) -> Result<bool, String> {
    let mut client_lock = state.client.lock().map_err(|e| e.to_string())?;
    let enabled = *state.enabled.lock().map_err(|e| e.to_string())?;

    if !enabled {
        return Ok(false);
    }

    let client = match client_lock.as_mut() {
        Some(c) => c,
        None => return Ok(false),
    };

    let start_time = *state.start_time.lock().map_err(|e| e.to_string())?;

    let timestamps = activity::Timestamps::new().start(start_time);

    let mut act = activity::Activity::new()
        .details(&details)
        .timestamps(timestamps);

    // Use a local binding so the reference lives long enough
    let status_str;
    if let Some(ref s) = status {
        status_str = s.clone();
        act = act.state(&status_str);
    }

    match client.set_activity(act) {
        Ok(_) => Ok(true),
        Err(e) => {
            // Connection lost — mark as disconnected
            let _ = client.close();
            *client_lock = None;
            *state.enabled.lock().map_err(|e| e.to_string())? = false;
            Err(format!("Discord connection lost: {}", e))
        }
    }
}

#[tauri::command]
pub fn discord_presence_is_connected(state: tauri::State<'_, DiscordPresenceState>) -> Result<bool, String> {
    let enabled = *state.enabled.lock().map_err(|e| e.to_string())?;
    Ok(enabled)
}
