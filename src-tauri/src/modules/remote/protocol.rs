//! Multiplexed WebSocket Protocol
//!
//! All communication happens over a single WebSocket connection.
//! Messages use a simple binary frame format for terminal I/O
//! and JSON text frames for commands/state.
//!
//! ## Frame Format (Text frames - JSON):
//! ```json
//! {"ch": "cmd", "action": "...", "data": {...}}   // commands
//! {"ch": "state", "event": "init", "data": {...}} // state pushes
//! {"ch": "term", "id": "term-1", "data": "..."}  // terminal output
//! {"ch": "term_exit", "id": "term-1"}             // terminal exited
//! ```
//!
//! ## Why text JSON instead of binary:
//! - Browser WebSocket API handles text natively
//! - Terminal data is already UTF-8 text (from PTY)
//! - Simpler debugging (can see messages in devtools)
//! - The overhead of JSON framing is negligible vs network latency
//!
//! ## Performance:
//! - Terminal output is batched at 60fps before sending
//! - Input keystrokes sent immediately (no batching)
//! - State updates pushed from server (no polling)

use serde::{Deserialize, Serialize};

// ─── Client → Server Messages ────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(tag = "ch", rename_all = "snake_case")]
pub enum ClientMessage {
    /// Terminal input (keystrokes)
    TermInput {
        id: String,
        data: String,
    },
    /// Terminal resize
    TermResize {
        id: String,
        cols: u16,
        rows: u16,
    },
    /// Command: create terminal
    CmdCreateTerminal {
        #[serde(default)]
        req_id: Option<String>,
        project_path: String,
        shell: Option<String>,
        context: Option<TerminalContextMsg>,
    },
    /// Command: create command terminal
    CmdCreateCommand {
        #[serde(default)]
        req_id: Option<String>,
        project_path: String,
        command: Vec<String>,
        context: Option<TerminalContextMsg>,
    },
    /// Command: close terminal
    CmdCloseTerminal {
        id: String,
    },
    /// Command: request state refresh
    CmdRefresh,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TerminalContextMsg {
    pub project_id: String,
    pub project_name: String,
    pub tab_id: String,
    pub tab_label: String,
}

impl From<TerminalContextMsg> for crate::modules::pty::TerminalContext {
    fn from(msg: TerminalContextMsg) -> Self {
        Self {
            project_id: msg.project_id,
            project_name: msg.project_name,
            tab_id: msg.tab_id,
            tab_label: msg.tab_label,
        }
    }
}

// ─── Server → Client Messages ────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(tag = "ch", rename_all = "snake_case")]
pub enum ServerMessage {
    /// Terminal output (batched)
    Term {
        id: String,
        data: String,
    },
    /// Terminal exited
    TermExit {
        id: String,
    },
    /// Terminal created (response to cmd)
    TermCreated {
        #[serde(skip_serializing_if = "Option::is_none")]
        req_id: Option<String>,
        id: String,
    },
    /// Error response
    Error {
        #[serde(skip_serializing_if = "Option::is_none")]
        req_id: Option<String>,
        error: String,
    },
    /// Full state push (sent on connect and on refresh)
    State {
        data: serde_json::Value,
    },
}

impl ServerMessage {
    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_default()
    }
}
