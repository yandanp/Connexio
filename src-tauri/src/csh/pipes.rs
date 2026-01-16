//! Pipe handling for CSH
//!
//! This module provides utilities for setting up and managing pipes
//! between commands in a pipeline.

use std::io::{Read, Write};
use std::process::{ChildStdout, Stdio};

/// Represents a pipe connection between two processes
pub struct PipeConnection {
    pub reader: Option<Box<dyn Read + Send>>,
    pub writer: Option<Box<dyn Write + Send>>,
}

impl PipeConnection {
    pub fn new() -> Self {
        Self {
            reader: None,
            writer: None,
        }
    }

    /// Create a pipe pair (reader and writer)
    pub fn create_pair() -> (Self, Self) {
        // For now, we rely on std::process::Stdio::piped()
        // This is a placeholder for more advanced pipe management
        (Self::new(), Self::new())
    }
}

impl Default for PipeConnection {
    fn default() -> Self {
        Self::new()
    }
}

/// Convert ChildStdout to Stdio for piping
pub fn stdout_to_stdin(stdout: ChildStdout) -> Stdio {
    Stdio::from(stdout)
}

/// Create a pipe buffer for in-memory piping
pub struct PipeBuffer {
    data: Vec<u8>,
    position: usize,
}

impl PipeBuffer {
    pub fn new() -> Self {
        Self {
            data: Vec::new(),
            position: 0,
        }
    }

    pub fn with_data(data: Vec<u8>) -> Self {
        Self { data, position: 0 }
    }
}

impl Read for PipeBuffer {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        let remaining = &self.data[self.position..];
        let to_read = std::cmp::min(buf.len(), remaining.len());
        buf[..to_read].copy_from_slice(&remaining[..to_read]);
        self.position += to_read;
        Ok(to_read)
    }
}

impl Write for PipeBuffer {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.data.extend_from_slice(buf);
        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

impl Default for PipeBuffer {
    fn default() -> Self {
        Self::new()
    }
}
