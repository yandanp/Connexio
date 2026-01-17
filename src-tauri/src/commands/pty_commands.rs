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
    let bytes = data.as_bytes();
    
    // Debug log for control characters
    if bytes.len() == 1 && bytes[0] < 32 {
        log::info!("[write_pty] Sending control character: 0x{:02X} (Ctrl+{}) to PTY {}", 
            bytes[0], 
            (bytes[0] + 64) as char,
            &pty_id[..8]);
    }
    
    state
        .0
        .write(&pty_id, bytes)
        .map_err(|e| e.to_string())
}

/// Send interrupt signal (Ctrl+C) to a PTY session
/// This is a dedicated command that uses Windows API on Windows
#[tauri::command]
pub async fn send_interrupt(
    pty_id: String,
    state: State<'_, PtyState>,
) -> Result<(), String> {
    log::info!("[send_interrupt] Sending interrupt to PTY {}", &pty_id[..8.min(pty_id.len())]);
    
    // Use the PTY manager's send_ctrl_c which uses Windows API
    state.0.send_ctrl_c(&pty_id).map_err(|e| e.to_string())?;
    
    log::info!("[send_interrupt] Interrupt sent to PTY {}", &pty_id[..8.min(pty_id.len())]);
    
    Ok(())
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

/// Kill child processes of a PTY session (not the shell itself)
/// Returns the number of child processes killed
#[tauri::command]
pub async fn kill_child_processes(
    pty_id: String,
    state: State<'_, PtyState>,
) -> Result<u32, String> {
    log::info!("[kill_child_processes] Killing child processes of PTY {}", &pty_id[..8.min(pty_id.len())]);
    
    let count = state.0.kill_child_processes(&pty_id).map_err(|e| e.to_string())?;
    
    log::info!("[kill_child_processes] Killed {} child processes", count);
    
    Ok(count)
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
