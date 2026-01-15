//! CLI argument parsing for Connexio
//!
//! Story 6.2: Support Command-Line Directory Parameter
//! Story 6.3: Support Command-Line Command Execution
//!
//! Supports:
//! - `-d` / `--directory`: Open terminal in specific directory
//! - `-e` / `--execute`: Execute a command in the terminal
//! - Positional directory argument (for context menu integration)

use clap::Parser;
use std::path::PathBuf;

/// Connexio - Modern Windows Terminal with Session Persistence
#[derive(Parser, Debug, Clone)]
#[command(author, version, about, long_about = None)]
pub struct CliArgs {
    /// Directory to open the terminal in
    #[arg(short = 'd', long = "directory")]
    pub directory: Option<PathBuf>,

    /// Command to execute in the terminal
    #[arg(short = 'e', long = "execute")]
    pub execute: Option<String>,

    /// Positional directory argument (alternative to -d)
    /// Used by Windows Explorer context menu
    #[arg(index = 1)]
    pub path: Option<PathBuf>,
}

impl CliArgs {
    /// Parse command line arguments
    pub fn parse_args() -> Self {
        Self::parse()
    }

    /// Get the working directory from either -d flag or positional argument
    pub fn get_working_directory(&self) -> Option<PathBuf> {
        // Prefer -d flag over positional argument
        self.directory.clone().or_else(|| self.path.clone())
    }

    /// Validate and normalize the working directory
    pub fn get_validated_directory(&self) -> Option<String> {
        self.get_working_directory().and_then(|path| {
            // Check if path exists and is a directory
            if path.exists() {
                if path.is_dir() {
                    path.to_str().map(|s| s.to_string())
                } else if path.is_file() {
                    // If it's a file, use its parent directory
                    path.parent()
                        .and_then(|p| p.to_str())
                        .map(|s| s.to_string())
                } else {
                    None
                }
            } else {
                log::warn!("Specified path does not exist: {:?}", path);
                None
            }
        })
    }

    /// Get the command to execute
    pub fn get_execute_command(&self) -> Option<String> {
        self.execute.clone()
    }

    /// Check if any startup arguments were provided
    pub fn has_startup_args(&self) -> bool {
        self.directory.is_some() || self.path.is_some() || self.execute.is_some()
    }
}

/// Startup configuration derived from CLI arguments
#[derive(Debug, Clone, serde::Serialize)]
pub struct StartupConfig {
    /// Working directory for the initial tab
    pub working_directory: Option<String>,
    /// Command to execute in the initial tab
    pub execute_command: Option<String>,
    /// Whether to skip session restore (when CLI args are provided)
    pub skip_session_restore: bool,
}

impl From<&CliArgs> for StartupConfig {
    fn from(args: &CliArgs) -> Self {
        let has_args = args.has_startup_args();
        Self {
            working_directory: args.get_validated_directory(),
            execute_command: args.get_execute_command(),
            // Skip session restore if user explicitly provided startup args
            skip_session_restore: has_args,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cli_args_default() {
        let args = CliArgs {
            directory: None,
            execute: None,
            path: None,
        };
        assert!(!args.has_startup_args());
        assert!(args.get_working_directory().is_none());
    }

    #[test]
    fn test_cli_args_with_directory() {
        let args = CliArgs {
            directory: Some(PathBuf::from("C:\\Users")),
            execute: None,
            path: None,
        };
        assert!(args.has_startup_args());
        assert_eq!(
            args.get_working_directory(),
            Some(PathBuf::from("C:\\Users"))
        );
    }

    #[test]
    fn test_cli_args_prefer_directory_over_path() {
        let args = CliArgs {
            directory: Some(PathBuf::from("C:\\Windows")),
            execute: None,
            path: Some(PathBuf::from("C:\\Users")),
        };
        assert_eq!(
            args.get_working_directory(),
            Some(PathBuf::from("C:\\Windows"))
        );
    }
}
