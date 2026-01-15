//! PTY Manager - Handles PTY lifecycle and session management
//!
//! This module manages multiple PTY sessions, handling spawning,
//! I/O streaming, resizing, and cleanup.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use anyhow::{Context, Result};
use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use super::types::{PtyExitPayload, PtyInfo, PtyOutputPayload, PtySpawnConfig, ShellType};

/// Represents an active PTY session
struct PtySession {
    /// The shell type for this session
    shell_type: ShellType,
    /// Working directory
    working_directory: Option<String>,
    /// Writer for sending input to the PTY
    writer: Box<dyn Write + Send>,
    /// The master PTY handle for resizing
    master: Box<dyn MasterPty + Send>,
    /// Flag to signal the reader thread to stop
    should_stop: Arc<Mutex<bool>>,
}

/// Manages all active PTY sessions
pub struct PtyManager {
    /// Map of session ID to PTY session
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
}

impl PtyManager {
    /// Create a new PTY manager
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Spawn a new PTY session with the given configuration
    pub fn spawn(
        &self,
        config: PtySpawnConfig,
        app_handle: AppHandle,
    ) -> Result<String> {
        let pty_system = native_pty_system();

        // Create the PTY with the specified size
        let pair = pty_system
            .openpty(PtySize {
                rows: config.rows,
                cols: config.cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .context("Failed to open PTY")?;

        // Build the shell command
        let mut cmd = CommandBuilder::new(config.shell_type.get_command());

        // Set working directory if specified
        if let Some(ref cwd) = config.working_directory {
            cmd.cwd(cwd);
        }

        // Set up environment for better terminal experience
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        // Spawn the shell process
        let mut child = pair
            .slave
            .spawn_command(cmd)
            .context("Failed to spawn shell process")?;

        log::info!("Shell process spawned successfully");

        // Generate unique session ID
        let pty_id = Uuid::new_v4().to_string();

        // Get the reader for output streaming
        let mut reader = pair
            .master
            .try_clone_reader()
            .context("Failed to clone PTY reader")?;

        // Get the writer for input
        let writer = pair
            .master
            .take_writer()
            .context("Failed to get PTY writer")?;

        // Create stop flag for the reader thread
        let should_stop = Arc::new(Mutex::new(false));
        let should_stop_clone = Arc::clone(&should_stop);

        // Store the session
        let session = PtySession {
            shell_type: config.shell_type.clone(),
            working_directory: config.working_directory.clone(),
            writer,
            master: pair.master,
            should_stop,
        };

        {
            let mut sessions = self.sessions.lock();
            sessions.insert(pty_id.clone(), session);
        }

        // Spawn thread to read PTY output and emit events
        let pty_id_clone = pty_id.clone();
        let app_handle_clone = app_handle.clone();
        let sessions_ref = Arc::clone(&self.sessions);

        thread::spawn(move || {
            let mut buffer = [0u8; 8192];

            loop {
                // Check if we should stop
                if *should_stop_clone.lock() {
                    break;
                }

                // Read output from PTY
                match reader.read(&mut buffer) {
                    Ok(0) => {
                        // EOF - process exited
                        break;
                    }
                    Ok(n) => {
                        // Convert to string (lossy to handle non-UTF8)
                        let data = String::from_utf8_lossy(&buffer[..n]).to_string();
                        
                        log::debug!(
                            "[PTY {}] Read {} bytes: {:?}",
                            &pty_id_clone[..8],
                            n,
                            if data.len() > 100 { &data[..100] } else { &data }
                        );

                        // Emit the output event
                        let payload = PtyOutputPayload {
                            pty_id: pty_id_clone.clone(),
                            data,
                        };

                        if let Err(e) = app_handle_clone.emit("pty-output", payload) {
                            log::error!("Failed to emit pty-output event: {}", e);
                        } else {
                            log::trace!("[PTY {}] Emitted pty-output event", &pty_id_clone[..8]);
                        }
                    }
                    Err(e) => {
                        // Check if it's just a would-block (non-blocking read)
                        if e.kind() != std::io::ErrorKind::WouldBlock {
                            log::error!("Error reading from PTY: {}", e);
                            break;
                        }
                        // Small sleep to avoid busy-waiting
                        thread::sleep(Duration::from_millis(10));
                    }
                }
            }

            // Process exited - get exit code
            let exit_code = child.wait().ok().map(|status| {
                status.exit_code() as i32
            });

            // Emit exit event
            let exit_payload = PtyExitPayload {
                pty_id: pty_id_clone.clone(),
                exit_code,
            };

            if let Err(e) = app_handle_clone.emit("pty-exit", exit_payload) {
                log::error!("Failed to emit pty-exit event: {}", e);
            }

            // Remove session from manager
            let mut sessions = sessions_ref.lock();
            sessions.remove(&pty_id_clone);

            log::info!("PTY session {} terminated", pty_id_clone);
        });

        log::info!(
            "Spawned PTY session {} with shell {:?}",
            pty_id,
            config.shell_type
        );

        Ok(pty_id)
    }

    /// Write input data to a PTY session
    pub fn write(&self, pty_id: &str, data: &[u8]) -> Result<()> {
        let mut sessions = self.sessions.lock();

        let session = sessions
            .get_mut(pty_id)
            .context("PTY session not found")?;

        session
            .writer
            .write_all(data)
            .context("Failed to write to PTY")?;

        session
            .writer
            .flush()
            .context("Failed to flush PTY writer")?;

        Ok(())
    }

    /// Resize a PTY session
    pub fn resize(&self, pty_id: &str, rows: u16, cols: u16) -> Result<()> {
        let sessions = self.sessions.lock();

        let session = sessions
            .get(pty_id)
            .context("PTY session not found")?;

        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .context("Failed to resize PTY")?;

        log::debug!("Resized PTY {} to {}x{}", pty_id, cols, rows);

        Ok(())
    }

    /// Kill a PTY session
    pub fn kill(&self, pty_id: &str) -> Result<()> {
        let mut sessions = self.sessions.lock();

        if let Some(session) = sessions.remove(pty_id) {
            // Signal the reader thread to stop
            *session.should_stop.lock() = true;
            log::info!("Killed PTY session {}", pty_id);
        }

        Ok(())
    }

    /// Get information about a PTY session
    pub fn get_info(&self, pty_id: &str) -> Option<PtyInfo> {
        let sessions = self.sessions.lock();

        sessions.get(pty_id).map(|session| PtyInfo {
            id: pty_id.to_string(),
            shell_type: session.shell_type.clone(),
            working_directory: session.working_directory.clone(),
            is_alive: true,
        })
    }

    /// Get all active PTY session IDs
    pub fn list_sessions(&self) -> Vec<String> {
        let sessions = self.sessions.lock();
        sessions.keys().cloned().collect()
    }

    /// Kill all PTY sessions (for app cleanup)
    pub fn kill_all(&self) {
        let mut sessions = self.sessions.lock();

        for (id, session) in sessions.drain() {
            *session.should_stop.lock() = true;
            log::info!("Killed PTY session {} during cleanup", id);
        }
    }
}

impl Default for PtyManager {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for PtyManager {
    fn drop(&mut self) {
        self.kill_all();
    }
}
