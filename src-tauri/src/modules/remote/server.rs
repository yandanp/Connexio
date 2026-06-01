use axum::{
    extract::{ws::WebSocketUpgrade, Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{Html, IntoResponse, Json},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex as StdMutex};
use tauri::{AppHandle, Listener, Manager};
use tokio::sync::{mpsc::UnboundedSender, Mutex};

use super::auth::AuthState;
use super::relay::handle_terminal_ws;

const DEFAULT_PORT: u16 = 9876;

// ─── State ───────────────────────────────────────────────────────────────────

pub struct RemoteState {
    pub auth: AuthState,
    pub app_handle: Option<AppHandle>,
    pub port: u16,
    pub is_running: bool,
    pub ws_clients: StdMutex<HashMap<String, Vec<UnboundedSender<String>>>>,
    shutdown_tx: Option<tokio::sync::oneshot::Sender<()>>,
}

impl RemoteState {
    pub fn new() -> Self {
        Self {
            auth: AuthState::new(),
            app_handle: None,
            port: DEFAULT_PORT,
            is_running: false,
            ws_clients: StdMutex::new(HashMap::new()),
            shutdown_tx: None,
        }
    }
}

/// Managed Tauri state wrapper
pub struct RemoteAccessState {
    pub inner: Arc<Mutex<RemoteState>>,
}

impl RemoteAccessState {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(RemoteState::new())),
        }
    }
}

// ─── API Types ───────────────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteStatusResponse {
    pub is_running: bool,
    pub port: u16,
    pub pin: String,
    pub local_ip: Option<String>,
    pub connected_clients: usize,
}

#[derive(Deserialize)]
struct AuthRequest {
    pin: String,
}

#[derive(Serialize)]
#[allow(dead_code)]
struct AuthResponse {
    token: String,
}

#[derive(Serialize)]
#[allow(dead_code)]
struct ErrorResponse {
    error: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalInfo {
    id: String,
    session_type: String,
}

#[derive(Deserialize)]
struct WsQuery {
    token: String,
}

// ─── Tauri Commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn remote_start(app: AppHandle, port: Option<u16>) -> Result<RemoteStatusResponse, String> {
    let state = app.state::<RemoteAccessState>();
    let mut remote = state.inner.lock().await;

    if remote.is_running {
        return Err("Remote access server is already running".to_string());
    }

    let port = port.unwrap_or(DEFAULT_PORT);
    remote.port = port;
    remote.app_handle = Some(app.clone());

    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();
    remote.shutdown_tx = Some(shutdown_tx);

    let shared_state = state.inner.clone();

    // Listen for terminal:data events and forward to WebSocket clients
    let ws_state = state.inner.clone();
    let _listener = app.listen("terminal:data", move |event| {
        let payload = event.payload();
        // Payload is a tuple (terminal_id, data) serialized as JSON array
        if let Ok(parsed) = serde_json::from_str::<(String, String)>(payload) {
            let (term_id, data) = parsed;
            if let Ok(ws_clients) = ws_state.try_lock() {
                if let Ok(clients) = ws_clients.ws_clients.lock() {
                    if let Some(senders) = clients.get(&term_id) {
                        for tx in senders {
                            let _ = tx.send(data.clone());
                        }
                    }
                }
            }
        }
    });

    // Start the HTTP/WS server in a background task
    tokio::spawn(async move {
        let app_state = shared_state.clone();

        let router = Router::new()
            .route("/", get(serve_index))
            .route("/api/auth", post(handle_auth))
            .route("/api/terminals", get(list_terminals))
            .route("/api/terminals/{id}/create", post(create_terminal))
            .route("/ws/terminal/{id}", get(ws_upgrade))
            .with_state(app_state);

        let addr = SocketAddr::from(([0, 0, 0, 0], port));
        let listener = match tokio::net::TcpListener::bind(addr).await {
            Ok(l) => l,
            Err(e) => {
                log::error!("Failed to bind remote access server: {}", e);
                return;
            }
        };

        log::info!("Remote access server started on port {}", port);

        axum::serve(listener, router)
            .with_graceful_shutdown(async {
                let _ = shutdown_rx.await;
            })
            .await
            .unwrap_or_else(|e| log::error!("Remote server error: {}", e));

        log::info!("Remote access server stopped");
    });

    remote.is_running = true;

    let local_ip = local_ip_address::local_ip()
        .ok()
        .map(|ip| ip.to_string());

    let connected = remote
        .ws_clients
        .lock()
        .unwrap()
        .values()
        .flatten()
        .filter(|tx| !tx.is_closed())
        .count();

    Ok(RemoteStatusResponse {
        is_running: true,
        port,
        pin: remote.auth.pin.clone(),
        local_ip,
        connected_clients: connected,
    })
}

#[tauri::command]
pub async fn remote_stop(app: AppHandle) -> Result<(), String> {
    let state = app.state::<RemoteAccessState>();
    let mut remote = state.inner.lock().await;

    if !remote.is_running {
        return Err("Remote access server is not running".to_string());
    }

    if let Some(tx) = remote.shutdown_tx.take() {
        let _ = tx.send(());
    }

    remote.is_running = false;
    remote.ws_clients.lock().unwrap().clear();

    log::info!("Remote access server stopped by user");
    Ok(())
}

#[tauri::command]
pub async fn remote_status(app: AppHandle) -> Result<RemoteStatusResponse, String> {
    let state = app.state::<RemoteAccessState>();
    let remote = state.inner.lock().await;

    let local_ip = local_ip_address::local_ip()
        .ok()
        .map(|ip| ip.to_string());

    let connected = remote
        .ws_clients
        .lock()
        .unwrap()
        .values()
        .flatten()
        .filter(|tx| !tx.is_closed())
        .count();

    Ok(RemoteStatusResponse {
        is_running: remote.is_running,
        port: remote.port,
        pin: remote.auth.pin.clone(),
        local_ip,
        connected_clients: connected,
    })
}

#[tauri::command]
pub async fn remote_regenerate_pin(app: AppHandle) -> Result<String, String> {
    let state = app.state::<RemoteAccessState>();
    let mut remote = state.inner.lock().await;
    remote.auth.regenerate_pin();
    Ok(remote.auth.pin.clone())
}

// ─── Axum Handlers ──────────────────────────────────────────────────────────

async fn serve_index() -> Html<&'static str> {
    Html(include_str!("../../../remote-ui/index.html"))
}

async fn handle_auth(
    State(state): State<Arc<Mutex<RemoteState>>>,
    Json(body): Json<AuthRequest>,
) -> impl IntoResponse {
    let mut remote = state.lock().await;
    match remote.auth.verify_pin(&body.pin) {
        Ok(token) => (StatusCode::OK, Json(serde_json::json!({ "token": token }))).into_response(),
        Err(err) => (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": err })),
        )
            .into_response(),
    }
}

async fn list_terminals(
    State(state): State<Arc<Mutex<RemoteState>>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let remote = state.lock().await;

    // Verify token
    let token = extract_token(&headers);
    if token.is_none() || !remote.auth.verify_token(token.unwrap()) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Unauthorized" })),
        )
            .into_response();
    }

    let Some(ref app) = remote.app_handle else {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "App not initialized" })),
        )
            .into_response();
    };

    let pty_mgr = app.state::<crate::modules::pty::PtyManager>();
    let sessions = pty_mgr.sessions.lock().unwrap();
    let terminals: Vec<TerminalInfo> = sessions
        .keys()
        .map(|id| TerminalInfo {
            id: id.clone(),
            session_type: "local".to_string(),
        })
        .collect();

    (StatusCode::OK, Json(serde_json::json!(terminals))).into_response()
}

async fn create_terminal(
    State(state): State<Arc<Mutex<RemoteState>>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let remote = state.lock().await;

    let token = extract_token(&headers);
    if token.is_none() || !remote.auth.verify_token(token.unwrap()) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Unauthorized" })),
        )
            .into_response();
    }

    // For now, return info that terminal creation should be done via the desktop app
    (
        StatusCode::OK,
        Json(serde_json::json!({ "message": "Use desktop app to create terminals", "id": id })),
    )
        .into_response()
}

async fn ws_upgrade(
    State(state): State<Arc<Mutex<RemoteState>>>,
    Path(id): Path<String>,
    Query(query): Query<WsQuery>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    // Verify token from query param
    let remote = state.lock().await;
    if !remote.auth.verify_token(&query.token) {
        return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
    }
    drop(remote);

    ws.on_upgrade(move |socket| handle_terminal_ws(socket, id, state))
        .into_response()
}

fn extract_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
}
