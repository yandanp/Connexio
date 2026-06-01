use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;
use tokio::time::{Duration, interval};

use super::server::RemoteState;

/// Buffer interval for terminal output batching (16ms ≈ 60fps)
const BUFFER_INTERVAL_MS: u64 = 16;

/// Handle a WebSocket connection for a terminal session.
/// Bridges the WebSocket to the PTY read/write via the Tauri app handle.
/// Output is batched at ~60fps to avoid flooding the WebSocket.
pub async fn handle_terminal_ws(
    socket: WebSocket,
    terminal_id: String,
    state: Arc<Mutex<RemoteState>>,
) {
    let (mut ws_sender, mut ws_receiver) = socket.split();

    let remote_state = state.lock().await;
    let app_handle = remote_state.app_handle.clone();
    drop(remote_state);

    let Some(app) = app_handle else {
        let _ = ws_sender
            .send(Message::Text(
                r#"{"error":"Server not initialized"}"#.into(),
            ))
            .await;
        return;
    };

    // Subscribe to terminal output via a channel
    let (output_tx, mut output_rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    // Register this WebSocket client for the terminal's output
    {
        let remote_state = state.lock().await;
        remote_state
            .ws_clients
            .lock()
            .unwrap()
            .entry(terminal_id.clone())
            .or_insert_with(Vec::new)
            .push(output_tx.clone());
    }

    let term_id_clone = terminal_id.clone();
    let state_clone = state.clone();

    // Task: forward terminal output to WebSocket with batching
    let send_task = tokio::spawn(async move {
        let mut buffer = String::with_capacity(8192);
        let mut tick = interval(Duration::from_millis(BUFFER_INTERVAL_MS));
        tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
            tokio::select! {
                // Receive data from PTY
                data = output_rx.recv() => {
                    match data {
                        Some(chunk) => {
                            buffer.push_str(&chunk);
                            // If buffer is large enough, flush immediately
                            if buffer.len() > 16384 {
                                if ws_sender.send(Message::Text(std::mem::take(&mut buffer).into())).await.is_err() {
                                    break;
                                }
                            }
                        }
                        None => {
                            // Channel closed, flush remaining
                            if !buffer.is_empty() {
                                let _ = ws_sender.send(Message::Text(std::mem::take(&mut buffer).into())).await;
                            }
                            break;
                        }
                    }
                }
                // Periodic flush at 60fps
                _ = tick.tick() => {
                    if !buffer.is_empty() {
                        if ws_sender.send(Message::Text(std::mem::take(&mut buffer).into())).await.is_err() {
                            break;
                        }
                    }
                }
            }
        }
    });

    // Task: forward WebSocket input to terminal PTY
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_receiver.next().await {
            match msg {
                Message::Text(text) => {
                    let text_str: &str = &text;
                    // Parse as JSON command
                    if let Ok(cmd) = serde_json::from_str::<WsCommand>(text_str) {
                        match cmd {
                            WsCommand::Input { data } => {
                                let pty_mgr = app.state::<crate::modules::pty::PtyManager>();
                                let mut sessions = pty_mgr.sessions.lock().unwrap();
                                if let Some(session) = sessions.get_mut(&term_id_clone) {
                                    let _ = write_to_session(session, data.as_bytes());
                                }
                            }
                            WsCommand::Resize { cols, rows } => {
                                let pty_mgr = app.state::<crate::modules::pty::PtyManager>();
                                let mut sessions = pty_mgr.sessions.lock().unwrap();
                                if let Some(session) = sessions.get_mut(&term_id_clone) {
                                    let _ = resize_session(session, cols, rows);
                                }
                            }
                        }
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }

        // Cleanup: remove this client
        let remote_state = state_clone.lock().await;
        let mut ws_clients = remote_state.ws_clients.lock().unwrap();
        if let Some(clients) = ws_clients.get_mut(&term_id_clone) {
            clients.retain(|tx| !tx.is_closed());
        }
        drop(ws_clients);
        drop(remote_state);
    });

    // Wait for either task to finish
    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }
}

#[derive(serde::Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum WsCommand {
    Input { data: String },
    Resize { cols: u16, rows: u16 },
}

/// Write bytes to a terminal session (local or SSH)
fn write_to_session(
    session: &mut crate::modules::pty::TerminalSession,
    data: &[u8],
) -> Result<(), String> {
    use std::io::Write;
    match session {
        crate::modules::pty::TerminalSession::Local(s) => s
            .writer
            .write_all(data)
            .map_err(|e| format!("Write error: {}", e)),
        crate::modules::pty::TerminalSession::Ssh(s) => {
            let mut channel = s.channel.lock().map_err(|_| "Lock poisoned".to_string())?;
            channel
                .write_all(data)
                .map_err(|e| format!("SSH write error: {}", e))?;
            channel
                .flush()
                .map_err(|e| format!("SSH flush error: {}", e))
        }
    }
}

/// Resize a terminal session
fn resize_session(
    session: &mut crate::modules::pty::TerminalSession,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    use portable_pty::PtySize;
    match session {
        crate::modules::pty::TerminalSession::Local(s) => {
            s.master
                .resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| format!("Resize error: {}", e))?;
            s.cols = cols;
            s.rows = rows;
            Ok(())
        }
        crate::modules::pty::TerminalSession::Ssh(s) => {
            let mut channel = s.channel.lock().map_err(|_| "Lock poisoned".to_string())?;
            channel
                .request_pty_size(cols as u32, rows as u32, None, None)
                .map_err(|e| format!("SSH resize error: {}", e))?;
            s.cols = cols;
            s.rows = rows;
            Ok(())
        }
    }
}
