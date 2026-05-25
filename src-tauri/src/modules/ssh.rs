use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn data_dir(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn ssh_file(app: &AppHandle, project_id: &str) -> PathBuf {
    data_dir(app).join("ssh").join(format!("{}.json", project_id))
}

fn ssh_global_file(app: &AppHandle) -> PathBuf {
    data_dir(app).join("ssh_global.json")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SSHConnection {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: String,
    pub private_key_path: Option<String>,
    pub color: Option<String>,
}

#[tauri::command]
pub fn ssh_list(app: AppHandle, project_id: String) -> Vec<SSHConnection> {
    let path = ssh_file(&app, &project_id);
    if !path.exists() {
        return vec![];
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default()
}

#[tauri::command]
pub fn ssh_save(app: AppHandle, project_id: String, connections: Vec<SSHConnection>) {
    let path = ssh_file(&app, &project_id);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(&connections).unwrap_or_default();
    let _ = fs::write(&path, json);
}

#[tauri::command]
pub fn ssh_list_global(app: AppHandle) -> Vec<SSHConnection> {
    let path = ssh_global_file(&app);
    if !path.exists() {
        return vec![];
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default()
}

#[tauri::command]
pub fn ssh_save_global(app: AppHandle, connections: Vec<SSHConnection>) {
    let path = ssh_global_file(&app);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(&connections).unwrap_or_default();
    let _ = fs::write(&path, json);
}

#[tauri::command]
pub fn ssh_build_command(connection: SSHConnection) -> String {
    let mut cmd = format!("ssh {}@{}", connection.username, connection.host);
    if connection.port != 22 {
        cmd = format!("ssh -p {} {}@{}", connection.port, connection.username, connection.host);
    }
    if connection.auth_method == "key" {
        if let Some(ref key_path) = connection.private_key_path {
            cmd = format!("{} -i \"{}\"", cmd, key_path);
        }
    }
    cmd
}

#[tauri::command]
pub fn ssh_key_exists(key_path: String) -> bool {
    std::path::Path::new(&key_path).exists()
}
