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
    TermInput { id: String, data: String },
    /// Terminal resize
    TermResize { id: String, cols: u16, rows: u16 },
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
    CmdCloseTerminal { id: String },
    /// Command: request state refresh
    CmdRefresh,
    /// Detect project tasks
    CmdDetectTasks {
        #[serde(default)]
        req_id: Option<String>,
        project_path: String,
    },
    /// List pinned commands
    CmdPinnedList {
        #[serde(default)]
        req_id: Option<String>,
        project_id: String,
    },
    /// Save pinned commands
    CmdPinnedSave {
        #[serde(default)]
        req_id: Option<String>,
        project_id: String,
        commands: Vec<crate::modules::pinned::PinnedCommand>,
    },
    /// Remote power command: lock or sleep the host PC
    CmdPower {
        #[serde(default)]
        req_id: Option<String>,
        action: PowerAction,
    },
    /// Heartbeat ping from client
    Ping,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TerminalContextMsg {
    pub project_id: String,
    pub project_name: String,
    pub tab_id: String,
    pub tab_label: String,
    #[serde(default)]
    pub pane_id: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum PowerAction {
    Lock,
    Sleep,
}

impl From<TerminalContextMsg> for crate::modules::pty::TerminalContext {
    fn from(msg: TerminalContextMsg) -> Self {
        Self {
            project_id: msg.project_id,
            project_name: msg.project_name,
            tab_id: msg.tab_id,
            tab_label: msg.tab_label,
            pane_id: msg.pane_id,
        }
    }
}

// ─── Server → Client Messages ────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(tag = "ch", rename_all = "snake_case")]
pub enum ServerMessage {
    /// Terminal output (batched)
    Term { id: String, data: String },
    /// Terminal exited
    TermExit { id: String },
    /// Terminal created (response to cmd)
    TermCreated {
        #[serde(skip_serializing_if = "Option::is_none")]
        req_id: Option<String>,
        id: String,
    },
    /// Generic command result
    CmdResult {
        #[serde(skip_serializing_if = "Option::is_none")]
        req_id: Option<String>,
        data: serde_json::Value,
    },
    /// Error response
    Error {
        #[serde(skip_serializing_if = "Option::is_none")]
        req_id: Option<String>,
        error: String,
    },
    /// Full state push (sent on connect and on refresh)
    State { data: serde_json::Value },
    /// Heartbeat pong from server
    Pong { ts: u64 },
}

impl ServerMessage {
    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::{ClientMessage, TerminalContextMsg};

    #[test]
    fn preserves_pane_id_when_deserializing_terminal_context() {
        let message: ClientMessage = serde_json::from_str(
			r#"{"ch":"cmd_create_terminal","project_path":"/repo","shell":null,"context":{"projectId":"project-1","projectName":"Project 1","tabId":"tab-1","tabLabel":"Split","paneId":"pane-2"}}"#,
		)
		.expect("terminal create message should deserialize");
        let ClientMessage::CmdCreateTerminal {
            context: Some(context),
            ..
        } = message
        else {
            panic!("expected a terminal create context");
        };

        assert_eq!(context.pane_id.as_deref(), Some("pane-2"));
        let pty_context: crate::modules::pty::TerminalContext = context.into();
        assert_eq!(pty_context.pane_id.as_deref(), Some("pane-2"));
    }

    #[test]
    fn accepts_legacy_terminal_context_without_pane_id() {
        let context: TerminalContextMsg = serde_json::from_str(
			r#"{"projectId":"project-1","projectName":"Project 1","tabId":"tab-1","tabLabel":"Terminal"}"#,
		)
		.expect("legacy context should deserialize");

        assert_eq!(context.pane_id, None);
    }
}
