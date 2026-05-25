use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn data_dir(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn projects_file(app: &AppHandle) -> PathBuf {
    data_dir(app).join("projects.json")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TabConfig {
    pub id: String,
    pub label: String,
    pub shell: Option<String>,
    pub command: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub group: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub tabs: Vec<TabConfig>,
    pub created_at: u64,
    pub last_opened_at: u64,
}

fn load_projects(app: &AppHandle) -> Vec<Project> {
    let path = projects_file(app);
    if !path.exists() {
        return vec![];
    }
    let content = fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&content).unwrap_or_default()
}

fn save_projects(app: &AppHandle, projects: &[Project]) {
    let path = projects_file(app);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(projects).unwrap_or_default();
    let _ = fs::write(&path, json);
}

#[tauri::command]
pub fn projects_list(app: AppHandle) -> Vec<Project> {
    load_projects(&app)
}

#[tauri::command]
pub fn projects_add(app: AppHandle, project: Project) -> Vec<Project> {
    let mut projects = load_projects(&app);
    projects.push(project);
    save_projects(&app, &projects);
    projects
}

#[tauri::command]
pub fn projects_update(app: AppHandle, project: Project) -> Vec<Project> {
    let mut projects = load_projects(&app);
    if let Some(existing) = projects.iter_mut().find(|p| p.id == project.id) {
        *existing = project;
    }
    save_projects(&app, &projects);
    projects
}

#[tauri::command]
pub fn projects_reorder(app: AppHandle, ids: Vec<String>) -> Vec<Project> {
    let projects = load_projects(&app);
    // Reorder projects according to the provided ID order
    let mut reordered: Vec<Project> = Vec::with_capacity(ids.len());
    for id in &ids {
        if let Some(p) = projects.iter().find(|p| p.id == *id) {
            reordered.push(p.clone());
        }
    }
    // Append any projects not in the ids list (safety net)
    for p in &projects {
        if !ids.contains(&p.id) {
            reordered.push(p.clone());
        }
    }
    save_projects(&app, &reordered);
    reordered
}

#[tauri::command]
pub fn projects_delete(app: AppHandle, id: String) -> Vec<Project> {
    let mut projects = load_projects(&app);
    projects.retain(|p| p.id != id);
    save_projects(&app, &projects);
    projects
}
