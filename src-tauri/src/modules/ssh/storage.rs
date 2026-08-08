use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use super::types::{SSHConnection, SSHKnownHost};

fn data_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
}

fn ssh_file(app: &AppHandle, project_id: &str) -> PathBuf {
    data_dir(app)
        .join("ssh")
        .join(format!("{}.json", project_id))
}

fn ssh_global_file(app: &AppHandle) -> PathBuf {
    data_dir(app).join("ssh_global.json")
}

fn ssh_known_hosts_file(app: &AppHandle) -> PathBuf {
    data_dir(app).join("ssh_known_hosts.json")
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

pub(super) fn ssh_load_known_hosts(app: &AppHandle) -> Vec<SSHKnownHost> {
    let path = ssh_known_hosts_file(app);
    if !path.exists() {
        return vec![];
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
        .unwrap_or_default()
}

pub(super) fn ssh_save_known_hosts(app: &AppHandle, hosts: &[SSHKnownHost]) -> Result<(), String> {
    let path = ssh_known_hosts_file(app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("Failed to create SSH data dir: {}", err))?;
    }
    let json = serde_json::to_string_pretty(hosts)
        .map_err(|err| format!("Failed to serialize known hosts: {}", err))?;
    fs::write(&path, json).map_err(|err| format!("Failed to save known hosts: {}", err))
}
