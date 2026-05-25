use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn data_dir(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn sessions_dir(app: &AppHandle) -> PathBuf {
    data_dir(app).join("sessions")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionTab {
    pub id: String,
    pub tab_config_id: String,
    pub scrollback: Option<String>,
    pub cwd: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub project_id: String,
    pub tabs: Vec<SessionTab>,
    pub saved_at: u64,
}

#[tauri::command]
pub fn session_save(app: AppHandle, session: Session) {
    let dir = sessions_dir(&app);
    let _ = fs::create_dir_all(&dir);
    let path = dir.join(format!("{}.json", session.id));
    let json = serde_json::to_string_pretty(&session).unwrap_or_default();
    let _ = fs::write(&path, json);
}

#[tauri::command]
pub fn session_load(app: AppHandle, id: String) -> Option<Session> {
    let path = sessions_dir(&app).join(format!("{}.json", id));
    if !path.exists() {
        return None;
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
}

#[tauri::command]
pub fn session_list(app: AppHandle) -> Vec<Session> {
    let dir = sessions_dir(&app);
    if !dir.exists() {
        return vec![];
    }
    let mut sessions = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            if entry.path().extension().map(|e| e == "json").unwrap_or(false) {
                if let Ok(content) = fs::read_to_string(entry.path()) {
                    if let Ok(session) = serde_json::from_str::<Session>(&content) {
                        sessions.push(session);
                    }
                }
            }
        }
    }
    sessions
}

#[tauri::command]
pub fn session_delete(app: AppHandle, id: String) {
    let path = sessions_dir(&app).join(format!("{}.json", id));
    let _ = fs::remove_file(&path);
}
