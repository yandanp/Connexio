//! PTY-related types and structures
//!
//! This module defines the core data structures used for PTY management.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Represents the type of shell to spawn
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ShellType {
    PowerShell,
    Cmd,
    Wsl,
    GitBash,
}

impl ShellType {
    /// Get the executable path/command for this shell type
    /// 
    /// For Git Bash, attempts to find the actual installation path
    /// to avoid conflicts with WSL bash.
    pub fn get_command(&self) -> String {
        match self {
            ShellType::PowerShell => "powershell.exe".to_string(),
            ShellType::Cmd => "cmd.exe".to_string(),
            ShellType::Wsl => "wsl.exe".to_string(),
            ShellType::GitBash => Self::find_git_bash_path(),
        }
    }

    /// Find Git Bash installation path
    /// 
    /// Checks common installation locations in order of preference:
    /// 1. Program Files\Git\bin\bash.exe
    /// 2. Program Files (x86)\Git\bin\bash.exe  
    /// 3. User's local Git installation
    /// 4. Falls back to "bash.exe" if nothing found
    fn find_git_bash_path() -> String {
        let possible_paths = [
            // Standard 64-bit installation
            r"C:\Program Files\Git\bin\bash.exe",
            // 32-bit installation on 64-bit Windows
            r"C:\Program Files (x86)\Git\bin\bash.exe",
            // Portable/custom installations
            r"C:\Git\bin\bash.exe",
            // Scoop installation
            r"C:\Users\scoop\apps\git\current\bin\bash.exe",
        ];

        // Check environment variable for Git installation
        if let Ok(git_dir) = std::env::var("GIT_DIR") {
            let git_bash = PathBuf::from(&git_dir).join("bin").join("bash.exe");
            if git_bash.exists() {
                return git_bash.to_string_lossy().to_string();
            }
        }

        // Check common installation paths
        for path in possible_paths {
            let path_buf = PathBuf::from(path);
            if path_buf.exists() {
                log::debug!("Found Git Bash at: {}", path);
                return path.to_string();
            }
        }

        // Try to find from PATH, but prefer git-bash specifically
        if let Ok(path_var) = std::env::var("PATH") {
            for path_entry in path_var.split(';') {
                if path_entry.to_lowercase().contains("git") {
                    let bash_path = PathBuf::from(path_entry).join("bash.exe");
                    if bash_path.exists() {
                        log::debug!("Found Git Bash in PATH: {:?}", bash_path);
                        return bash_path.to_string_lossy().to_string();
                    }
                }
            }
        }

        // Fallback - this may not work but provides a reasonable default
        log::warn!("Git Bash not found in common locations, falling back to 'bash.exe'");
        "bash.exe".to_string()
    }

    /// Get the display name for this shell type
    pub fn display_name(&self) -> &'static str {
        match self {
            ShellType::PowerShell => "PowerShell",
            ShellType::Cmd => "Command Prompt",
            ShellType::Wsl => "WSL",
            ShellType::GitBash => "Git Bash",
        }
    }
}

impl Default for ShellType {
    fn default() -> Self {
        ShellType::PowerShell
    }
}

/// Configuration for spawning a new PTY session
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtySpawnConfig {
    /// The type of shell to spawn
    pub shell_type: ShellType,
    /// Initial working directory (optional)
    pub working_directory: Option<String>,
    /// Initial terminal size - rows
    pub rows: u16,
    /// Initial terminal size - columns
    pub cols: u16,
}

impl Default for PtySpawnConfig {
    fn default() -> Self {
        Self {
            shell_type: ShellType::default(),
            working_directory: None,
            rows: 24,
            cols: 80,
        }
    }
}

/// PTY output event payload sent to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyOutputPayload {
    /// The ID of the PTY session
    pub pty_id: String,
    /// The output data (UTF-8 encoded)
    pub data: String,
}

/// PTY exit event payload sent to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyExitPayload {
    /// The ID of the PTY session
    pub pty_id: String,
    /// The exit code of the process (if available)
    pub exit_code: Option<i32>,
}

/// PTY resize request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyResizeRequest {
    /// The ID of the PTY session
    pub pty_id: String,
    /// New number of rows
    pub rows: u16,
    /// New number of columns
    pub cols: u16,
}

/// Information about a PTY session
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyInfo {
    /// Unique identifier for this PTY session
    pub id: String,
    /// The shell type running in this PTY
    pub shell_type: ShellType,
    /// Current working directory (if known)
    pub working_directory: Option<String>,
    /// Whether the PTY is still running
    pub is_alive: bool,
}
