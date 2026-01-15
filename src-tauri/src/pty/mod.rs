//! PTY module for terminal emulation
//!
//! This module provides PTY (pseudo-terminal) functionality using
//! Windows ConPTY API through the portable-pty crate.

pub mod manager;
pub mod types;

pub use manager::PtyManager;
pub use types::*;
