//! PTY Manager - Handles PTY lifecycle and session management
//!
//! This module manages multiple PTY sessions, handling spawning,
//! I/O streaming, resizing, and cleanup.
//!
//! ## UTF-8 and Escape Sequence Handling
//!
//! Terminal output can contain:
//! - Multi-byte UTF-8 characters that might be split across buffer reads
//! - ANSI escape sequences (e.g., `\x1b[32m`) that might be split across reads
//!
//! This implementation handles both cases by:
//! 1. Finding valid UTF-8 boundaries before emitting data
//! 2. Carrying over incomplete bytes to the next read cycle

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

/// Find the last valid UTF-8 boundary in a byte slice.
/// Returns the number of bytes that form valid UTF-8.
/// Any trailing incomplete UTF-8 sequence should be carried over to the next read.
fn find_utf8_boundary(bytes: &[u8]) -> usize {
    if bytes.is_empty() {
        return 0;
    }

    // Try to decode the entire buffer
    match std::str::from_utf8(bytes) {
        Ok(_) => bytes.len(), // All bytes are valid UTF-8
        Err(e) => {
            // valid_up_to() gives us the position of the first invalid byte
            let valid_up_to = e.valid_up_to();
            
            // Check if the error is due to an incomplete sequence at the end
            // (as opposed to truly invalid bytes in the middle)
            if e.error_len().is_none() {
                // Incomplete sequence at end - return only the valid portion
                valid_up_to
            } else {
                // There's actually invalid data - this shouldn't happen with PTY output
                // but we handle it gracefully by including up to the error point
                valid_up_to
            }
        }
    }
}

/// Find if we're in the middle of an ANSI escape sequence.
/// Returns the position where an incomplete escape sequence starts, or None if complete.
/// 
/// Escape sequences typically look like:
/// - CSI: `\x1b[...m` or `\x1b[...H` etc.
/// - OSC: `\x1b]...;\x07` or `\x1b]...;\x1b\\`
/// - Simple: `\x1bM`, `\x1b7`, etc.
fn find_incomplete_escape_sequence(data: &str) -> Option<usize> {
    // Look for the last ESC character
    if let Some(last_esc_pos) = data.rfind('\x1b') {
        let after_esc = &data[last_esc_pos..];
        
        // Check if this escape sequence is complete
        // A complete CSI sequence ends with a letter (A-Z, a-z) or specific chars
        // A complete OSC sequence ends with BEL (\x07) or ST (\x1b\\)
        
        if after_esc.len() == 1 {
            // Just ESC by itself - incomplete
            return Some(last_esc_pos);
        }
        
        let bytes = after_esc.as_bytes();
        
        // CSI sequence: ESC [
        if bytes.len() >= 2 && bytes[1] == b'[' {
            // Look for terminating character (letter or specific chars like @, `, ~)
            for (i, &b) in bytes[2..].iter().enumerate() {
                if b.is_ascii_alphabetic() || b == b'@' || b == b'`' || b == b'~' {
                    // Sequence is complete, check if there's another ESC after
                    let seq_end = last_esc_pos + 2 + i + 1;
                    if seq_end < data.len() {
                        // There might be more content or another sequence
                        return find_incomplete_escape_sequence(&data[seq_end..])
                            .map(|p| seq_end + p);
                    }
                    return None; // Complete
                }
            }
            // No terminator found - incomplete CSI
            return Some(last_esc_pos);
        }
        
        // OSC sequence: ESC ]
        if bytes.len() >= 2 && bytes[1] == b']' {
            // Look for BEL (\x07) or ST (ESC \)
            if after_esc.contains('\x07') || after_esc.contains("\x1b\\") {
                return None; // Complete
            }
            // No terminator - incomplete OSC
            return Some(last_esc_pos);
        }
        
        // Simple escape sequences (ESC followed by single char)
        if bytes.len() >= 2 {
            let second = bytes[1];
            // Common single-char sequences: ESC 7, ESC 8, ESC M, ESC D, ESC E, etc.
            if second.is_ascii_alphabetic() || second.is_ascii_digit() 
                || second == b'=' || second == b'>' || second == b'<' {
                return None; // Complete
            }
        }
        
        // Unknown or incomplete sequence
        Some(last_esc_pos)
    } else {
        None // No ESC found
    }
}

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
            // Increased buffer size for better performance with fast output
            let mut buffer = [0u8; 16384];
            // Carryover buffer for incomplete UTF-8 sequences or escape sequences
            let mut carryover: Vec<u8> = Vec::with_capacity(256);

            loop {
                // Check if we should stop
                if *should_stop_clone.lock() {
                    break;
                }

                // Read output from PTY
                match reader.read(&mut buffer) {
                    Ok(0) => {
                        // EOF - process exited
                        // Emit any remaining carryover data
                        if !carryover.is_empty() {
                            let data = String::from_utf8_lossy(&carryover).to_string();
                            let payload = PtyOutputPayload {
                                pty_id: pty_id_clone.clone(),
                                data,
                            };
                            let _ = app_handle_clone.emit("pty-output", payload);
                        }
                        break;
                    }
                    Ok(n) => {
                        // Combine carryover with new data
                        let combined = if carryover.is_empty() {
                            buffer[..n].to_vec()
                        } else {
                            let mut c = std::mem::take(&mut carryover);
                            c.extend_from_slice(&buffer[..n]);
                            c
                        };

                        // Find valid UTF-8 boundary
                        let utf8_boundary = find_utf8_boundary(&combined);
                        
                        if utf8_boundary == 0 && combined.len() < 6 {
                            // Not enough data yet for valid UTF-8, wait for more
                            carryover = combined;
                            continue;
                        }

                        // Split at UTF-8 boundary
                        let (valid_bytes, remaining) = combined.split_at(utf8_boundary);
                        
                        // Convert valid bytes to string
                        let data = match std::str::from_utf8(valid_bytes) {
                            Ok(s) => s.to_string(),
                            Err(_) => {
                                // Fallback: use lossy conversion
                                String::from_utf8_lossy(valid_bytes).to_string()
                            }
                        };

                        // Check for incomplete escape sequences at the end
                        let (data_to_emit, escape_carryover) = 
                            if let Some(esc_pos) = find_incomplete_escape_sequence(&data) {
                                // Split at the incomplete escape sequence
                                let (emit, carry) = data.split_at(esc_pos);
                                (emit.to_string(), Some(carry.as_bytes().to_vec()))
                            } else {
                                (data, None)
                            };

                        // Store remaining bytes for next iteration
                        carryover = if let Some(esc) = escape_carryover {
                            let mut c = esc;
                            c.extend_from_slice(remaining);
                            c
                        } else {
                            remaining.to_vec()
                        };

                        // Only emit if we have data
                        if !data_to_emit.is_empty() {
                            log::debug!(
                                "[PTY {}] Read {} bytes, emitting {} chars",
                                &pty_id_clone[..8],
                                n,
                                data_to_emit.len()
                            );

                            // Emit the output event
                            let payload = PtyOutputPayload {
                                pty_id: pty_id_clone.clone(),
                                data: data_to_emit,
                            };

                            if let Err(e) = app_handle_clone.emit("pty-output", payload) {
                                log::error!("Failed to emit pty-output event: {}", e);
                            }
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
