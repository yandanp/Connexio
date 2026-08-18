use serde::Serialize;
use std::path::PathBuf;

/// Install state of one CLI agent binary.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatus {
    pub command: String,
    pub installed: bool,
}

/// Where to look for a binary, per-platform.
fn candidate_paths(command: &str) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if cfg!(windows) {
        // Windows: rely on PATH lookup plus the usual extensions.
        for ext in ["", ".exe", ".cmd", ".bat"] {
            paths.push(PathBuf::from(format!("{command}{ext}")));
        }
    } else {
        paths.push(PathBuf::from(command));
    }
    paths
}

/// Check whether a command resolves on PATH (or as an absolute path).
fn is_installed(command: &str) -> bool {
    if command.contains(std::path::MAIN_SEPARATOR) || command.contains('/') {
        // Absolute/relative path — check it directly.
        return PathBuf::from(command).exists();
    }
    let Some(path_var) = std::env::var_os("PATH") else {
        return false;
    };
    std::env::split_paths(&path_var).any(|dir| {
        candidate_paths(command)
            .iter()
            .any(|c| dir.join(c).exists())
    })
}

/// Detect which of the given agent commands are installed on this machine.
/// Runs the checks in parallel via `spawn_blocking`-friendly sync code.
#[tauri::command]
pub async fn agent_detect_all(commands: Vec<String>) -> Vec<AgentStatus> {
    tokio::task::spawn_blocking(move || {
        commands
            .into_iter()
            .map(|command| {
                let installed = is_installed(&command);
                AgentStatus { command, installed }
            })
            .collect()
    })
    .await
    .unwrap_or_default()
}

#[cfg(test)]
#[path = "agents_tests.rs"]
mod agents_tests;
