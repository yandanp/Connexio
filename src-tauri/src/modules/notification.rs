use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

const MAX_NOTIFICATIONS: usize = 200;
const DEDUPE_WINDOW_MS: u128 = 3000;

// ─── Types ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnexioNotification {
    pub id: String,
    pub source: String,
    pub provider: Option<String>,
    pub title: String,
    pub body: String,
    pub tab_id: Option<String>,
    pub project_id: Option<String>,
    pub terminal_id: Option<String>,
    pub project_name: Option<String>,
    pub tab_label: Option<String>,
    pub timestamp: u64,
    pub is_read: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationSettings {
    pub enabled: bool,
    pub sound: bool,
    pub sound_volume: f64,
    pub custom_sound_path: Option<String>,
    pub show_when_focused: bool,
    pub idle_notify: bool,
    pub idle_threshold: u32,
}

impl Default for NotificationSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            sound: true,
            sound_volume: 0.5,
            custom_sound_path: None,
            show_when_focused: false,
            idle_notify: false,
            idle_threshold: 5,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIProvider {
    pub id: String,
    pub name: String,
    pub is_installed: bool,
    pub is_hook_installed: bool,
}

// ─── State ───────────────────────────────────────────────────────────────────

pub struct NotificationState {
    pub notifications: Mutex<Vec<ConnexioNotification>>,
    pub settings: Mutex<NotificationSettings>,
    pub server_port: Mutex<Option<u16>>,
    dedupe: Mutex<HashMap<String, u128>>,
}

impl NotificationState {
    pub fn new() -> Self {
        Self {
            notifications: Mutex::new(Vec::new()),
            settings: Mutex::new(NotificationSettings::default()),
            server_port: Mutex::new(None),
            dedupe: Mutex::new(HashMap::new()),
        }
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn data_dir(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn notifications_file(app: &AppHandle) -> PathBuf {
    data_dir(app).join("notifications.json")
}

fn notif_settings_file(app: &AppHandle) -> PathBuf {
    data_dir(app).join("notification_settings.json")
}

fn now_ms() -> u128 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis()
}

fn now_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()
}

fn load_notifications(app: &AppHandle) -> Vec<ConnexioNotification> {
    let path = notifications_file(app);
    if !path.exists() { return vec![]; }
    fs::read_to_string(&path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default()
}

fn save_notifications(app: &AppHandle, notifications: &[ConnexioNotification]) {
    let path = notifications_file(app);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(notifications).unwrap_or_default();
    let _ = fs::write(&path, json);
}

fn load_notif_settings(app: &AppHandle) -> NotificationSettings {
    let path = notif_settings_file(app);
    if !path.exists() { return NotificationSettings::default(); }
    fs::read_to_string(&path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default()
}

fn save_notif_settings(app: &AppHandle, settings: &NotificationSettings) {
    let path = notif_settings_file(app);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(settings).unwrap_or_default();
    let _ = fs::write(&path, json);
}

// ─── TCP Notification Server ─────────────────────────────────────────────────

pub fn start_notification_server(app: &AppHandle) {
    let state = app.state::<NotificationState>();
    let app_handle = app.clone();

    // Bind to random port on localhost
    let listener = match TcpListener::bind("127.0.0.1:0") {
        Ok(l) => l,
        Err(_) => return,
    };

    let port = listener.local_addr().map(|a| a.port()).unwrap_or(0);
    if port == 0 { return; }

    {
        let mut sp = state.server_port.lock().unwrap();
        *sp = Some(port);
    }

    // Load persisted data
    {
        let loaded = load_notifications(&app_handle);
        let mut notifs = state.notifications.lock().unwrap();
        *notifs = loaded;
    }
    {
        let loaded = load_notif_settings(&app_handle);
        let mut settings = state.settings.lock().unwrap();
        *settings = loaded;
    }

    log::info!("Notification server listening on port {}", port);

    // Spawn listener thread
    let state_arc = Arc::new(app_handle.clone());
    thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let app_clone = state_arc.clone();
            thread::spawn(move || {
                let reader = BufReader::new(&stream);
                let mut data = String::new();
                for line in reader.lines().flatten() {
                    data.push_str(&line);
                    data.push('\n');
                }
                if !data.trim().is_empty() {
                    process_message(&app_clone, data.trim());
                }
            });
        }
    });
}

fn process_message(app: &AppHandle, raw: &str) {
    let state = app.state::<NotificationState>();

    for line in raw.lines() {
        let line = line.trim();
        if line.is_empty() { continue; }

        let notification = if line.starts_with('{') {
            // JSON format
            parse_json_notification(line)
        } else {
            // Legacy pipe format: type|title|body
            parse_legacy_notification(line)
        };

        let Some(notification) = notification else { continue };

        // Dedupe
        let dedupe_key = format!(
            "{}|{}|{}",
            notification.provider.as_deref().unwrap_or(""),
            notification.title,
            notification.body
        );
        let now = now_ms();
        {
            let mut dedupe = state.dedupe.lock().unwrap();
            if let Some(&last) = dedupe.get(&dedupe_key) {
                if now - last < DEDUPE_WINDOW_MS { continue; }
            }
            dedupe.insert(dedupe_key, now);
            // Cleanup old entries
            dedupe.retain(|_, v| now - *v < DEDUPE_WINDOW_MS);
        }

        // Store
        {
            let mut notifs = state.notifications.lock().unwrap();
            notifs.insert(0, notification.clone());
            if notifs.len() > MAX_NOTIFICATIONS {
                notifs.truncate(MAX_NOTIFICATIONS);
            }
            save_notifications(app, &notifs);
        }

        // Emit to frontend
        let _ = app.emit("notification:received", &notification);
    }
}

fn parse_json_notification(line: &str) -> Option<ConnexioNotification> {
    let payload: serde_json::Value = serde_json::from_str(line).ok()?;
    Some(ConnexioNotification {
        id: Uuid::new_v4().to_string(),
        source: payload.get("source").and_then(|v| v.as_str()).unwrap_or("agent").to_string(),
        provider: payload.get("provider").and_then(|v| v.as_str()).map(|s| s.to_string()),
        title: payload.get("title").and_then(|v| v.as_str()).unwrap_or("Notification").to_string(),
        body: payload.get("body").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        tab_id: payload.get("tabId").and_then(|v| v.as_str()).map(|s| s.to_string()),
        project_id: payload.get("projectId").and_then(|v| v.as_str()).map(|s| s.to_string()),
        terminal_id: payload.get("terminalId").and_then(|v| v.as_str()).map(|s| s.to_string()),
        project_name: payload.get("projectName").and_then(|v| v.as_str()).map(|s| s.to_string()),
        tab_label: payload.get("tabLabel").and_then(|v| v.as_str()).map(|s| s.to_string()),
        timestamp: now_secs(),
        is_read: false,
    })
}

fn parse_legacy_notification(line: &str) -> Option<ConnexioNotification> {
    let parts: Vec<&str> = line.splitn(3, '|').collect();
    if parts.len() < 2 { return None; }

    Some(ConnexioNotification {
        id: Uuid::new_v4().to_string(),
        source: "agent".to_string(),
        provider: Some(parts[0].trim().to_string()),
        title: parts[1].trim().to_string(),
        body: parts.get(2).map(|s| s.trim().to_string()).unwrap_or_default(),
        tab_id: None,
        project_id: None,
        terminal_id: None,
        project_name: None,
        tab_label: None,
        timestamp: now_secs(),
        is_read: false,
    })
}

// ─── AI Provider Hooks ───────────────────────────────────────────────────────

fn home_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
}

fn hooks_dir(app: &AppHandle) -> PathBuf {
    // In production: bundled in resources
    // In dev: assets/hooks/ in project root
    let resource_dir = app.path().resource_dir().unwrap_or_else(|_| PathBuf::from("."));
    let prod_path = resource_dir.join("assets").join("hooks");
    if prod_path.exists() {
        return prod_path;
    }
    // Dev fallback
    PathBuf::from("assets").join("hooks")
}

fn is_claude_installed() -> bool {
    home_dir().join(".claude").exists()
}

fn is_claude_hook_installed() -> bool {
    let settings_path = home_dir().join(".claude").join("settings.json");
    if !settings_path.exists() { return false; }
    fs::read_to_string(&settings_path)
        .map(|c| c.contains("# connexio-notification-hook"))
        .unwrap_or(false)
}

fn is_opencode_installed() -> bool {
    let paths = [
        home_dir().join(".config").join("opencode"),
        home_dir().join(".opencode"),
    ];
    paths.iter().any(|p| p.exists())
}

fn is_opencode_hook_installed() -> bool {
    home_dir().join(".config").join("opencode").join("plugin").join("connexio-notify.js").exists()
}

fn is_pi_installed() -> bool {
    home_dir().join(".pi").join("agent").exists()
}

fn is_pi_hook_installed() -> bool {
    home_dir().join(".pi").join("agent").join("extensions").join("connexio-notify.ts").exists()
}

fn install_hook_file(app: &AppHandle, source_name: &str, dest: &PathBuf) -> Result<(), String> {
    let source = hooks_dir(app).join(source_name);
    if !source.exists() {
        return Err(format!("Hook source not found: {}", source.display()));
    }
    if let Some(parent) = dest.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::copy(&source, dest).map(|_| ()).map_err(|e| e.to_string())
}

// ─── Commands ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn notification_list(app: AppHandle) -> Vec<ConnexioNotification> {
    let state = app.state::<NotificationState>();
    let notifs = state.notifications.lock().unwrap().clone();
    notifs
}

#[tauri::command]
pub fn notification_unread_count(app: AppHandle) -> usize {
    let state = app.state::<NotificationState>();
    let count = state.notifications.lock().unwrap().iter().filter(|n| !n.is_read).count();
    count
}

#[tauri::command]
pub fn notification_mark_read(app: AppHandle, id: String) {
    let state = app.state::<NotificationState>();
    let mut notifs = state.notifications.lock().unwrap();
    if let Some(n) = notifs.iter_mut().find(|n| n.id == id) {
        n.is_read = true;
    }
    save_notifications(&app, &notifs);
}

#[tauri::command]
pub fn notification_mark_all_read(app: AppHandle) {
    let state = app.state::<NotificationState>();
    let mut notifs = state.notifications.lock().unwrap();
    for n in notifs.iter_mut() {
        n.is_read = true;
    }
    save_notifications(&app, &notifs);
}

#[tauri::command]
pub fn notification_remove(app: AppHandle, id: String) {
    let state = app.state::<NotificationState>();
    let mut notifs = state.notifications.lock().unwrap();
    notifs.retain(|n| n.id != id);
    save_notifications(&app, &notifs);
}

#[tauri::command]
pub fn notification_clear(app: AppHandle) {
    let state = app.state::<NotificationState>();
    let mut notifs = state.notifications.lock().unwrap();
    notifs.clear();
    save_notifications(&app, &notifs);
}

#[tauri::command]
pub fn notification_get_settings(app: AppHandle) -> NotificationSettings {
    let state = app.state::<NotificationState>();
    let settings = state.settings.lock().unwrap().clone();
    settings
}

#[tauri::command]
pub fn notification_update_settings(app: AppHandle, settings: NotificationSettings) -> NotificationSettings {
    let state = app.state::<NotificationState>();
    let mut current = state.settings.lock().unwrap();
    *current = settings.clone();
    save_notif_settings(&app, &current);
    settings
}

#[tauri::command]
pub fn notification_get_port(app: AppHandle) -> Option<u16> {
    let state = app.state::<NotificationState>();
    let port = *state.server_port.lock().unwrap();
    port
}

#[tauri::command]
pub fn notification_get_providers() -> Vec<AIProvider> {
    vec![
        AIProvider {
            id: "claude".to_string(),
            name: "Claude Code".to_string(),
            is_installed: is_claude_installed(),
            is_hook_installed: is_claude_hook_installed(),
        },
        AIProvider {
            id: "opencode".to_string(),
            name: "OpenCode".to_string(),
            is_installed: is_opencode_installed(),
            is_hook_installed: is_opencode_hook_installed(),
        },
        AIProvider {
            id: "pi".to_string(),
            name: "Pi Agent".to_string(),
            is_installed: is_pi_installed(),
            is_hook_installed: is_pi_hook_installed(),
        },
    ]
}

#[tauri::command]
pub fn notification_install_hook(app: AppHandle, provider_id: String) -> Result<(), String> {
    match provider_id.as_str() {
        "claude" => {
            // Claude uses settings.json modification
            let settings_path = home_dir().join(".claude").join("settings.json");
            let settings_dir = settings_path.parent().unwrap();
            let _ = fs::create_dir_all(settings_dir);

            let mut settings: serde_json::Value = if settings_path.exists() {
                let content = fs::read_to_string(&settings_path).unwrap_or_default();
                serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
            } else {
                serde_json::json!({})
            };

            let hook_script = hooks_dir(&app).join("connexio-claude-hook.ps1");
            let marker = "# connexio-notification-hook";
            let command = format!(
                "powershell -ExecutionPolicy Bypass -File \"{}\" -Event stop {}",
                hook_script.display(), marker
            );

            let hook_entry = serde_json::json!({
                "matcher": "",
                "hooks": [{"type": "command", "command": command, "timeout": 10}]
            });

            if !settings.get("hooks").is_some() {
                settings["hooks"] = serde_json::json!({});
            }
            settings["hooks"]["Stop"] = serde_json::json!([hook_entry]);

            fs::write(&settings_path, serde_json::to_string_pretty(&settings).unwrap_or_default())
                .map_err(|e| e.to_string())
        }
        "opencode" => {
            let dest = home_dir().join(".config").join("opencode").join("plugin").join("connexio-notify.js");
            install_hook_file(&app, "connexio-opencode-plugin.js", &dest)
        }
        "pi" => {
            let dest = home_dir().join(".pi").join("agent").join("extensions").join("connexio-notify.ts");
            install_hook_file(&app, "connexio-pi-hook.ts", &dest)
        }
        _ => Err(format!("Unknown provider: {}", provider_id)),
    }
}

#[tauri::command]
pub fn notification_uninstall_hook(provider_id: String) -> Result<(), String> {
    match provider_id.as_str() {
        "claude" => {
            let settings_path = home_dir().join(".claude").join("settings.json");
            if !settings_path.exists() { return Ok(()); }
            let content = fs::read_to_string(&settings_path).unwrap_or_default();
            let mut settings: serde_json::Value = serde_json::from_str(&content).unwrap_or(serde_json::json!({}));
            if let Some(hooks) = settings.get_mut("hooks") {
                if let Some(obj) = hooks.as_object_mut() {
                    obj.remove("Stop");
                    obj.remove("Notification");
                }
            }
            fs::write(&settings_path, serde_json::to_string_pretty(&settings).unwrap_or_default())
                .map_err(|e| e.to_string())
        }
        "opencode" => {
            let path = home_dir().join(".config").join("opencode").join("plugin").join("connexio-notify.js");
            if path.exists() { let _ = fs::remove_file(&path); }
            Ok(())
        }
        "pi" => {
            let path = home_dir().join(".pi").join("agent").join("extensions").join("connexio-notify.ts");
            if path.exists() { let _ = fs::remove_file(&path); }
            Ok(())
        }
        _ => Err(format!("Unknown provider: {}", provider_id)),
    }
}

#[tauri::command]
pub fn notification_upload_sound(_app: AppHandle) -> Result<serde_json::Value, String> {
    // This will be triggered from frontend using tauri-plugin-dialog
    // For now return stub — frontend handles file picker via dialog plugin
    Ok(serde_json::json!({"success": false, "error": "Use dialog plugin from frontend"}))
}

#[tauri::command]
pub fn notification_remove_custom_sound(app: AppHandle) -> Result<(), String> {
    let state = app.state::<NotificationState>();
    let mut settings = state.settings.lock().unwrap();
    if let Some(ref path) = settings.custom_sound_path {
        if std::path::Path::new(path).exists() {
            let _ = fs::remove_file(path);
        }
    }
    settings.custom_sound_path = None;
    save_notif_settings(&app, &settings);
    Ok(())
}

#[tauri::command]
pub fn notification_get_sound_path(app: AppHandle) -> Option<String> {
    let state = app.state::<NotificationState>();
    let path = state.settings.lock().unwrap().custom_sound_path.clone();
    path
}
