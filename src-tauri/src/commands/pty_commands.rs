//! PTY-related Tauri commands
//!
//! These commands handle PTY operations invoked from the frontend.

use std::sync::Arc;
use tauri::{AppHandle, State};

use crate::pty::{PtyManager, PtySpawnConfig, PtyInfo, ShellType};

/// Tauri state wrapper for PTY manager
pub struct PtyState(pub Arc<PtyManager>);

/// Spawn a new PTY session
///
/// Returns the unique PTY session ID on success.
#[tauri::command]
pub async fn spawn_shell(
    config: PtySpawnConfig,
    app_handle: AppHandle,
    state: State<'_, PtyState>,
) -> Result<String, String> {
    state
        .0
        .spawn(config, app_handle)
        .map_err(|e| e.to_string())
}

/// Write data to a PTY session
#[tauri::command]
pub async fn write_pty(
    pty_id: String,
    data: String,
    state: State<'_, PtyState>,
) -> Result<(), String> {
    state
        .0
        .write(&pty_id, data.as_bytes())
        .map_err(|e| e.to_string())
}

/// Resize a PTY session
#[tauri::command]
pub async fn resize_pty(
    pty_id: String,
    rows: u16,
    cols: u16,
    state: State<'_, PtyState>,
) -> Result<(), String> {
    state
        .0
        .resize(&pty_id, rows, cols)
        .map_err(|e| e.to_string())
}

/// Kill a PTY session
#[tauri::command]
pub async fn kill_pty(
    pty_id: String,
    state: State<'_, PtyState>,
) -> Result<(), String> {
    state
        .0
        .kill(&pty_id)
        .map_err(|e| e.to_string())
}

/// Get information about a PTY session
#[tauri::command]
pub async fn get_pty_info(
    pty_id: String,
    state: State<'_, PtyState>,
) -> Result<Option<PtyInfo>, String> {
    Ok(state.0.get_info(&pty_id))
}

/// List all active PTY sessions
#[tauri::command]
pub async fn list_pty_sessions(
    state: State<'_, PtyState>,
) -> Result<Vec<String>, String> {
    Ok(state.0.list_sessions())
}

/// Quick spawn with default settings for a specific shell type
#[tauri::command]
pub async fn spawn_default_shell(
    shell_type: ShellType,
    working_directory: Option<String>,
    app_handle: AppHandle,
    state: State<'_, PtyState>,
) -> Result<String, String> {
    let config = PtySpawnConfig {
        shell_type,
        working_directory,
        rows: 24,
        cols: 80,
    };

    state
        .0
        .spawn(config, app_handle)
        .map_err(|e| e.to_string())
}
