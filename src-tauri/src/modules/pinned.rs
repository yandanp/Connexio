use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn data_dir(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn pinned_file(app: &AppHandle, project_id: &str) -> PathBuf {
    data_dir(app).join("pinned").join(format!("{}.json", project_id))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PinnedCommand {
    pub id: String,
    pub label: String,
    pub command: String,
    pub color: Option<String>,
}

#[tauri::command]
pub fn pinned_list(app: AppHandle, project_id: String) -> Vec<PinnedCommand> {
    let path = pinned_file(&app, &project_id);
    if !path.exists() {
        return vec![];
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default()
}

#[tauri::command]
pub fn pinned_save(app: AppHandle, project_id: String, commands: Vec<PinnedCommand>) {
    let path = pinned_file(&app, &project_id);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(&commands).unwrap_or_default();
    let _ = fs::write(&path, json);
}
