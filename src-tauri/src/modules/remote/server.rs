use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, Query, State},
    http::{HeaderMap, StatusCode},
    response::{Html, IntoResponse, Json},
    routing::{get, post},
    Router,
};
use futures_util::{SinkExt, StreamExt};
use rand::Rng;
use serde::Deserialize;
use std::collections::HashMap;
use std::io::Write;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex as StdMutex};
use tauri::{AppHandle, Listener, Manager};
use tokio::sync::mpsc;
use tokio::time::{Duration, interval};
use tower_http::services::{ServeDir, ServeFile};

use super::protocol::{ClientMessage, ServerMessage};

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_PORT: u16 = 9876;
const PIN_LENGTH: usize = 6;
const MAX_PIN_ATTEMPTS: u32 = 5;
const LOCKOUT_SECS: u64 = 300;
const OUTPUT_BUFFER_INTERVAL_MS: u64 = 16; // 60fps
const OUTPUT_FLUSH_THRESHOLD: usize = 32768; // flush immediately if buffer > 32KB

// ─── State ───────────────────────────────────────────────────────────────────

/// Per-client sender for multiplexed messages
type ClientSender = mpsc::UnboundedSender<String>;

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteClientInfo {
    pub id: String,
    pub user_agent: String,
    pub connected_at: u64,
}

pub struct RemoteState {
    pin: String,
    app_handle: Option<AppHandle>,
    port: u16,
    is_running: bool,
    failed_attempts: u32,
    lockout_until: Option<u64>,
    /// All connected clients (client_id → sender)
    clients: HashMap<String, ClientSender>,
    client_info: HashMap<String, RemoteClientInfo>,
    /// Terminal output buffers: term_id → accumulated output
    /// Flushed to all clients at 60fps
    output_buffers: HashMap<String, String>,
    shutdown_tx: Option<tokio::sync::oneshot::Sender<()>>,
}

impl RemoteState {
    fn new() -> Self {
        Self {
            pin: generate_pin(),
            app_handle: None,
            port: DEFAULT_PORT,
            is_running: false,
            failed_attempts: 0,
            lockout_until: None,
            clients: HashMap::new(),
            client_info: HashMap::new(),
            output_buffers: HashMap::new(),
            shutdown_tx: None,
        }
    }

    fn broadcast(&self, msg: &str) {
        for sender in self.clients.values() {
            let _ = sender.send(msg.to_string());
        }
    }
}

/// Tauri-managed state
pub struct RemoteAccessState {
    pub inner: Arc<StdMutex<RemoteState>>,
}

impl RemoteAccessState {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(StdMutex::new(RemoteState::new())),
        }
    }
}

// ─── Tauri Commands ──────────────────────────────────────────────────────────

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteStatusResponse {
    pub is_running: bool,
    pub port: u16,
    pub pin: String,
    pub local_ip: Option<String>,
    pub connected_clients: usize,
    pub clients: Vec<RemoteClientInfo>,
}

#[tauri::command]
pub async fn remote_start(app: AppHandle, port: Option<u16>) -> Result<RemoteStatusResponse, String> {
    let state = app.state::<RemoteAccessState>();

    {
        let s = state.inner.lock().unwrap();
        if s.is_running {
            return Err("Remote access server is already running".to_string());
        }
    }

    let port = port.unwrap_or(DEFAULT_PORT);

    {
        let mut s = state.inner.lock().unwrap();
        s.port = port;
        s.app_handle = Some(app.clone());
        s.is_running = true;
    }

    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();
    {
        let mut s = state.inner.lock().unwrap();
        s.shutdown_tx = Some(shutdown_tx);
    }

    let shared = state.inner.clone();

    // Start output flush loop (60fps)
    let flush_state = state.inner.clone();
    tokio::spawn(async move {
        let mut tick = interval(Duration::from_millis(OUTPUT_BUFFER_INTERVAL_MS));
        tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            tick.tick().await;
            let mut s = flush_state.lock().unwrap();
            if !s.is_running {
                break;
            }
            // Flush all terminal output buffers
            let buffers: Vec<(String, String)> = s.output_buffers
                .drain()
                .filter(|(_, data)| !data.is_empty())
                .collect();
            for (term_id, data) in buffers {
                let msg = ServerMessage::Term { id: term_id, data };
                let json = msg.to_json();
                s.broadcast(&json);
            }
        }
    });

    // Listen for terminal:data events → buffer output
    let data_state = state.inner.clone();
    let _data_listener = app.listen("terminal:data", move |event| {
        let payload = event.payload();
        if let Ok((term_id, data)) = serde_json::from_str::<(String, String)>(payload) {
            let mut s = data_state.lock().unwrap();
            let buffer = s.output_buffers.entry(term_id.clone()).or_default();
            buffer.push_str(&data);
            // Flush immediately if buffer is large
            if buffer.len() > OUTPUT_FLUSH_THRESHOLD {
                let flushed = std::mem::take(buffer);
                let msg = ServerMessage::Term { id: term_id, data: flushed };
                let json = msg.to_json();
                s.broadcast(&json);
            }
        }
    });

    // Listen for terminal:exit events
    let exit_state = state.inner.clone();
    let _exit_listener = app.listen("terminal:exit", move |event| {
        let payload = event.payload();
        if let Ok(term_id) = serde_json::from_str::<String>(payload) {
            let s = exit_state.lock().unwrap();
            let msg = ServerMessage::TermExit { id: term_id };
            s.broadcast(&msg.to_json());
        }
    });

    // Start HTTP/WS server
    tokio::spawn(async move {
        let frontend_dir = resolve_frontend_dir();

        let app_routes = Router::new()
            .route("/api/auth", post(handle_auth))
            .route("/ws", get(ws_upgrade))
            .with_state(shared.clone());

        let router = if frontend_dir.exists() {
            let index = frontend_dir.join("index.html");
            let serve = ServeDir::new(&frontend_dir).fallback(ServeFile::new(index));
            app_routes.fallback_service(serve)
        } else {
            app_routes.route("/", get(serve_fallback))
        };

        let addr = SocketAddr::from(([0, 0, 0, 0], port));
        let listener = match tokio::net::TcpListener::bind(addr).await {
            Ok(l) => l,
            Err(e) => {
                log::error!("Remote server bind failed: {}", e);
                return;
            }
        };

        log::info!("Remote access server on port {}", port);

        axum::serve(listener, router)
            .with_graceful_shutdown(async { let _ = shutdown_rx.await; })
            .await
            .unwrap_or_else(|e| log::error!("Remote server error: {}", e));

        log::info!("Remote access server stopped");
    });

    let local_ip = local_ip_address::local_ip().ok().map(|ip| ip.to_string());
    let s = state.inner.lock().unwrap();

    Ok(RemoteStatusResponse {
        is_running: true,
        port,
        pin: s.pin.clone(),
        local_ip,
        connected_clients: s.clients.len(),
        clients: s.client_info.values().cloned().collect(),
    })
}

#[tauri::command]
pub async fn remote_stop(app: AppHandle) -> Result<(), String> {
    let state = app.state::<RemoteAccessState>();
    let mut s = state.inner.lock().unwrap();

    if !s.is_running {
        return Err("Server not running".to_string());
    }

    if let Some(tx) = s.shutdown_tx.take() {
        let _ = tx.send(());
    }

    s.is_running = false;
    s.clients.clear();
    s.client_info.clear();
    s.output_buffers.clear();
    Ok(())
}

#[tauri::command]
pub async fn remote_status(app: AppHandle) -> Result<RemoteStatusResponse, String> {
    let state = app.state::<RemoteAccessState>();
    let s = state.inner.lock().unwrap();
    let local_ip = local_ip_address::local_ip().ok().map(|ip| ip.to_string());

    Ok(RemoteStatusResponse {
        is_running: s.is_running,
        port: s.port,
        pin: s.pin.clone(),
        local_ip,
        connected_clients: s.clients.len(),
        clients: s.client_info.values().cloned().collect(),
    })
}

#[tauri::command]
pub async fn remote_regenerate_pin(app: AppHandle) -> Result<String, String> {
    let state = app.state::<RemoteAccessState>();
    let mut s = state.inner.lock().unwrap();
    s.pin = generate_pin();
    s.failed_attempts = 0;
    s.lockout_until = None;
    Ok(s.pin.clone())
}

// ─── HTTP Handlers ───────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct AuthRequest {
    pin: String,
}

#[derive(Deserialize)]
struct WsQueryParams {
    pin: String,
}

async fn handle_auth(
    State(state): State<Arc<StdMutex<RemoteState>>>,
    Json(body): Json<AuthRequest>,
) -> impl IntoResponse {
    let mut s = state.lock().unwrap();

    // Check lockout
    let now = now_secs();
    if let Some(until) = s.lockout_until {
        if now < until {
            return (StatusCode::TOO_MANY_REQUESTS, Json(serde_json::json!({
                "error": format!("Locked out. Try again in {} seconds.", until - now)
            }))).into_response();
        }
        s.lockout_until = None;
        s.failed_attempts = 0;
    }

    if body.pin == s.pin {
        s.failed_attempts = 0;
        (StatusCode::OK, Json(serde_json::json!({ "ok": true }))).into_response()
    } else {
        s.failed_attempts += 1;
        if s.failed_attempts >= MAX_PIN_ATTEMPTS {
            s.lockout_until = Some(now + LOCKOUT_SECS);
            (StatusCode::TOO_MANY_REQUESTS, Json(serde_json::json!({
                "error": "Too many attempts. Locked for 5 minutes."
            }))).into_response()
        } else {
            let remaining = MAX_PIN_ATTEMPTS - s.failed_attempts;
            (StatusCode::UNAUTHORIZED, Json(serde_json::json!({
                "error": format!("Invalid PIN. {} attempts left.", remaining)
            }))).into_response()
        }
    }
}

async fn ws_upgrade(
    State(state): State<Arc<StdMutex<RemoteState>>>,
    Query(params): Query<WsQueryParams>,
    headers: HeaderMap,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    // Verify PIN
    {
        let s = state.lock().unwrap();
        if params.pin != s.pin {
            return (StatusCode::UNAUTHORIZED, "Invalid PIN").into_response();
        }
    }

    let user_agent = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("Unknown device")
        .to_string();

    ws.on_upgrade(move |socket| handle_ws_client(socket, state, user_agent))
        .into_response()
}

async fn serve_fallback() -> Html<&'static str> {
    Html(include_str!("../../../remote-ui/index.html"))
}

// ─── WebSocket Client Handler ────────────────────────────────────────────────

async fn handle_ws_client(socket: WebSocket, state: Arc<StdMutex<RemoteState>>, user_agent: String) {
    let (mut ws_tx, mut ws_rx) = socket.split();
    let (client_tx, mut client_rx) = mpsc::unbounded_channel::<String>();

    let client_id = uuid::Uuid::new_v4().to_string();

    // Register client & get app handle
    let app_handle = {
        let mut s = state.lock().unwrap();
        s.clients.insert(client_id.clone(), client_tx);
        s.client_info.insert(client_id.clone(), RemoteClientInfo {
            id: client_id.clone(),
            user_agent,
            connected_at: now_secs(),
        });
        s.app_handle.clone()
    };

    let Some(app) = app_handle else {
        let _ = ws_tx.send(Message::Text(
            ServerMessage::Error { req_id: None, error: "Server not ready".into() }.to_json().into()
        )).await;
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
            if cols == 0 || rows == 0 { return; }
            let mut sessions = pty.sessions.lock().unwrap();
            if let Some(session) = sessions.get_mut(&id) {
                let _ = resize_session(session, cols, rows);
            }
        }
        ClientMessage::CmdCreateTerminal { req_id, project_path, shell, context } => {
            // Remote resume: if a terminal already exists for this project/tab,
            // return the existing terminal ID instead of spawning a duplicate.
            if let Some(ref ctx) = context {
                if let Some(existing_id) = pty.find_by_context(&ctx.project_id, &ctx.tab_id) {
                    let msg = ServerMessage::TermCreated { req_id, id: existing_id };
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
        ClientMessage::CmdCreateCommand { req_id, project_path, command, context } => {
            if let Some(ref ctx) = context {
                if let Some(existing_id) = pty.find_by_context(&ctx.project_id, &ctx.tab_id) {
                    let msg = ServerMessage::TermCreated { req_id, id: existing_id };
                    send_to_client(state, client_id, &msg.to_json());
                    return;
                }
            }
            let ctx = context.map(|c| c.into());
            match crate::modules::pty::terminal_create_command(app.clone(), project_path, command, ctx) {
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

// ─── PTY Helpers ─────────────────────────────────────────────────────────────

fn write_session(session: &mut crate::modules::pty::TerminalSession, data: &[u8]) -> Result<(), String> {
    match session {
        crate::modules::pty::TerminalSession::Local(s) => {
            s.writer.write_all(data).map_err(|e| e.to_string())?;
            Ok(())
        }
        crate::modules::pty::TerminalSession::Ssh(s) => {
            let mut ch = s.channel.lock().map_err(|_| "lock poisoned")?;
            ch.write_all(data).map_err(|e| e.to_string())?;
            ch.flush().map_err(|e| e.to_string())?;
            Ok(())
        }
    }
}

fn resize_session(session: &mut crate::modules::pty::TerminalSession, cols: u16, rows: u16) -> Result<(), String> {
    use portable_pty::PtySize;
    match session {
        crate::modules::pty::TerminalSession::Local(s) => {
            s.master.resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
                .map_err(|e| e.to_string())?;
            s.cols = cols;
            s.rows = rows;
            Ok(())
        }
        crate::modules::pty::TerminalSession::Ssh(s) => {
            let mut ch = s.channel.lock().map_err(|_| "lock poisoned")?;
            ch.request_pty_size(cols as u32, rows as u32, None, None)
                .map_err(|e| e.to_string())?;
            s.cols = cols;
            s.rows = rows;
            Ok(())
        }
    }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

fn generate_pin() -> String {
    let mut rng = rand::thread_rng();
    format!("{:0>width$}", rng.gen_range(0..10u32.pow(PIN_LENGTH as u32)), width = PIN_LENGTH)
}

fn resolve_frontend_dir() -> std::path::PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        let dir = exe.parent().unwrap_or(std::path::Path::new("."));
        let candidate = dir.join("dist").join("renderer");
        if candidate.exists() { return candidate; }
        let candidate = dir.join("../../../dist/renderer");
        if candidate.exists() { return candidate; }
    }
    std::path::PathBuf::from("dist/renderer")
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
}
