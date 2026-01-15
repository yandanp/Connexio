//! Connexio - Modern Windows Terminal with Session Persistence
//!
//! This is the main library for the Connexio terminal application.
//! It provides PTY management, session persistence, and Tauri integration.

use std::sync::Arc;
use parking_lot::Mutex;

// Modules
pub mod cli;
pub mod commands;
pub mod pty;

// Re-exports
use cli::{CliArgs, StartupConfig};
use commands::pty_commands::PtyState;
use commands::{
    get_pty_info, kill_pty, list_pty_sessions, resize_pty, spawn_default_shell, spawn_shell,
    write_pty,
};
use pty::PtyManager;

/// Global startup configuration parsed from CLI args
static STARTUP_CONFIG: Mutex<Option<StartupConfig>> = Mutex::new(None);

/// Get the startup configuration (called from frontend)
#[tauri::command]
fn get_startup_config() -> Option<StartupConfig> {
    STARTUP_CONFIG.lock().clone()
}

/// Clear the startup configuration (called after it's been consumed)
#[tauri::command]
fn clear_startup_config() {
    *STARTUP_CONFIG.lock() = None;
}

/// Tauri application entry point
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    log::info!("Starting Connexio terminal application");

    // Parse CLI arguments
    let cli_args = CliArgs::parse_args();
    log::info!("CLI arguments: {:?}", cli_args);

    // Create startup config from CLI args
    let startup_config = StartupConfig::from(&cli_args);
    if startup_config.skip_session_restore {
        log::info!("Startup config: {:?}", startup_config);
    }

    // Store startup config globally for frontend to access
    *STARTUP_CONFIG.lock() = Some(startup_config);

    // Create the PTY manager
    let pty_manager = Arc::new(PtyManager::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        // Register PTY state
        .manage(PtyState(pty_manager))
        // Register all commands
        .invoke_handler(tauri::generate_handler![
            // PTY commands
            spawn_shell,
            write_pty,
            resize_pty,
            kill_pty,
            get_pty_info,
            list_pty_sessions,
            spawn_default_shell,
            // CLI commands
            get_startup_config,
            clear_startup_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
