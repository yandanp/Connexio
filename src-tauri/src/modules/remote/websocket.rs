use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use std::sync::{Arc, Mutex as StdMutex};
use tauri::{AppHandle, Manager};
use tokio::sync::mpsc;

use super::power::run_power_action;
use super::protocol::{ClientMessage, ServerMessage};
use super::pty_bridge::{resize_session, write_session};
use super::state::{now_secs, RemoteClientInfo, RemoteState};

// ─── WebSocket Client Handler ────────────────────────────────────────────────

pub(super) async fn handle_ws_client(
    socket: WebSocket,
    state: Arc<StdMutex<RemoteState>>,
    user_agent: String,
) {
    let (mut ws_tx, mut ws_rx) = socket.split();
    let (client_tx, mut client_rx) = mpsc::unbounded_channel::<String>();

    let client_id = uuid::Uuid::new_v4().to_string();

    // Register client & get app handle
    let app_handle = {
        let mut s = state.lock().unwrap();
        s.clients.insert(client_id.clone(), client_tx);
        s.client_info.insert(
            client_id.clone(),
            RemoteClientInfo {
                id: client_id.clone(),
                user_agent,
                connected_at: now_secs(),
            },
        );
        s.app_handle.clone()
    };

    let Some(app) = app_handle else {
        let _ = ws_tx
            .send(Message::Text(
                ServerMessage::Error {
                    req_id: None,
                    error: "Server not ready".into(),
                }
                .to_json()
                .into(),
            ))
            .await;
        return;
    };

    // Send initial state immediately
    let init_data = gather_init_state(&app);
    let init_msg = ServerMessage::State { data: init_data };
    let _ = ws_tx.send(Message::Text(init_msg.to_json().into())).await;

    // Task: forward server messages to WebSocket
    let send_task = tokio::spawn(async move {
        while let Some(msg) = client_rx.recv().await {
            if ws_tx.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    // Task: handle incoming messages from client
    let recv_state = state.clone();
    let recv_app = app.clone();
    let recv_client_id = client_id.clone();
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_rx.next().await {
            match msg {
                Message::Text(text) => {
                    let text_str: &str = &text;
                    if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(text_str) {
                        handle_client_message(client_msg, &recv_app, &recv_state, &recv_client_id);
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    // Cleanup
    let mut s = state.lock().unwrap();
    s.clients.remove(&client_id);
    s.client_info.remove(&client_id);
}

fn handle_client_message(
    msg: ClientMessage,
    app: &AppHandle,
    state: &Arc<StdMutex<RemoteState>>,
    client_id: &str,
) {
    let pty = app.state::<crate::modules::pty::PtyManager>();

    match msg {
        ClientMessage::TermInput { id, data } => {
            let mut sessions = pty.sessions.lock().unwrap();
            if let Some(session) = sessions.get_mut(&id) {
                let _ = write_session(session, data.as_bytes());
            }
        }
        ClientMessage::TermResize { id, cols, rows } => {
            if cols == 0 || rows == 0 {
                return;
            }
            let mut sessions = pty.sessions.lock().unwrap();
            if let Some(session) = sessions.get_mut(&id) {
                let _ = resize_session(session, cols, rows);
            }
        }
        ClientMessage::CmdCreateTerminal {
            req_id,
            project_path,
            shell,
            context,
        } => {
            // Remote resume identifies every terminal leaf, not just its parent tab.
            if let Some(ref ctx) = context {
                if let Some(existing_id) =
                    pty.find_by_context(&ctx.project_id, &ctx.tab_id, ctx.pane_id.as_deref())
                {
                    let msg = ServerMessage::TermCreated {
                        req_id,
                        id: existing_id,
                    };
                    send_to_client(state, client_id, &msg.to_json());
                    return;
                }
            }
            let ctx = context.map(|c| c.into());
            match crate::modules::pty::terminal_create(app.clone(), project_path, shell, ctx) {
                Ok(id) => {
                    let msg = ServerMessage::TermCreated { req_id, id };
                    send_to_client(state, client_id, &msg.to_json());
                }
                Err(e) => {
                    let msg = ServerMessage::Error { req_id, error: e };
                    send_to_client(state, client_id, &msg.to_json());
                }
            }
        }
        ClientMessage::CmdCreateCommand {
            req_id,
            project_path,
            command,
            context,
        } => {
            if let Some(ref ctx) = context {
                if let Some(existing_id) =
                    pty.find_by_context(&ctx.project_id, &ctx.tab_id, ctx.pane_id.as_deref())
                {
                    let msg = ServerMessage::TermCreated {
                        req_id,
                        id: existing_id,
                    };
                    send_to_client(state, client_id, &msg.to_json());
                    return;
                }
            }
            let ctx = context.map(|c| c.into());
            match crate::modules::pty::terminal_create_command(
                app.clone(),
                project_path,
                command,
                ctx,
            ) {
                Ok(id) => {
                    let msg = ServerMessage::TermCreated { req_id, id };
                    send_to_client(state, client_id, &msg.to_json());
                }
                Err(e) => {
                    let msg = ServerMessage::Error { req_id, error: e };
                    send_to_client(state, client_id, &msg.to_json());
                }
            }
        }
        ClientMessage::CmdCloseTerminal { id } => {
            let _ = crate::modules::pty::terminal_close(app.clone(), id);
        }
        ClientMessage::CmdRefresh => {
            let data = gather_init_state(app);
            let msg = ServerMessage::State { data };
            send_to_client(state, client_id, &msg.to_json());
        }
        ClientMessage::CmdDetectTasks {
            req_id,
            project_path,
        } => {
            let tasks = crate::modules::tasks::tasks_detect(app.clone(), project_path);
            let msg = ServerMessage::CmdResult {
                req_id,
                data: serde_json::json!(tasks),
            };
            send_to_client(state, client_id, &msg.to_json());
        }
        ClientMessage::CmdPinnedList { req_id, project_id } => {
            let commands = crate::modules::pinned::pinned_list(app.clone(), project_id);
            let msg = ServerMessage::CmdResult {
                req_id,
                data: serde_json::json!(commands),
            };
            send_to_client(state, client_id, &msg.to_json());
        }
        ClientMessage::CmdPinnedSave {
            req_id,
            project_id,
            commands,
        } => {
            crate::modules::pinned::pinned_save(app.clone(), project_id, commands);
            let msg = ServerMessage::CmdResult {
                req_id,
                data: serde_json::json!(null),
            };
            send_to_client(state, client_id, &msg.to_json());
        }
        ClientMessage::CmdPower { req_id, action } => match run_power_action(action) {
            Ok(_) => {
                let msg = ServerMessage::CmdResult {
                    req_id,
                    data: serde_json::json!(null),
                };
                send_to_client(state, client_id, &msg.to_json());
            }
            Err(e) => {
                let msg = ServerMessage::Error { req_id, error: e };
                send_to_client(state, client_id, &msg.to_json());
            }
        },
        ClientMessage::Ping => {
            let msg = ServerMessage::Pong { ts: now_secs() };
            send_to_client(state, client_id, &msg.to_json());
        }
    }
}

fn send_to_client(state: &Arc<StdMutex<RemoteState>>, client_id: &str, msg: &str) {
    let s = state.lock().unwrap();
    if let Some(tx) = s.clients.get(client_id) {
        let _ = tx.send(msg.to_string());
    }
}

// ─── State Gathering ─────────────────────────────────────────────────────────

fn gather_init_state(app: &AppHandle) -> serde_json::Value {
    let projects = crate::modules::projects::projects_list(app.clone());
    let settings = crate::modules::settings::settings_get(app.clone());
    let workspace = crate::modules::workspace::workspace_get_state(app.clone());
    let theme = crate::modules::theme::theme_get(app.clone());
    let themes = crate::modules::theme::theme_list();
    let shells = crate::modules::settings::settings_get_shells();
    let version = env!("CARGO_PKG_VERSION");

    // Get active terminal IDs
    let pty = app.state::<crate::modules::pty::PtyManager>();
    let terminals = pty.session_ids();

    serde_json::json!({
        "projects": projects,
        "settings": settings,
        "workspace": workspace,
        "theme": theme,
        "themes": themes,
        "shells": shells,
        "version": version,
        "terminals": terminals,
    })
}
