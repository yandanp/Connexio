use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn data_dir(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn workspace_file(app: &AppHandle) -> PathBuf {
    data_dir(app).join("workspace.json")
}

// === Workspace Tab State ===

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceTabState {
    pub id: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shell: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "type")]
    pub tab_type: Option<String>, // "terminal" | "editor" | "preview"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    /// Split layout tree — stored as opaque JSON to avoid frontend/backend struct drift
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "splitTree")]
    pub split_tree: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceState {
    pub active_project_id: Option<String>,
    pub project_tabs: std::collections::HashMap<String, Vec<WorkspaceTabState>>,
    pub active_tab_ids: std::collections::HashMap<String, String>,
}

#[tauri::command]
pub fn workspace_get_state(app: AppHandle) -> WorkspaceState {
    let path = workspace_file(&app);
    if !path.exists() {
        return WorkspaceState::default();
    }
    let content = fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&content).unwrap_or_default()
}

#[tauri::command]
pub fn workspace_save_state(app: AppHandle, state: WorkspaceState) {
    let path = workspace_file(&app);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(&state).unwrap_or_default();
    let _ = fs::write(&path, json);
}
