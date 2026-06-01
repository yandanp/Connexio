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
use tower_http::services::ServeDir;

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
    /// Cached app handle for fast access without locking
    pub cached_app: StdMutex<Option<AppHandle>>,
    /// JWT secret for token verification without locking full state
    pub jwt_secret: StdMutex<String>,
}

impl RemoteAccessState {
    pub fn new() -> Self {
        let state = RemoteState::new();
        let secret = state.auth.secret.clone();
        Self {
            inner: Arc::new(Mutex::new(state)),
            cached_app: StdMutex::new(None),
            jwt_secret: StdMutex::new(secret),
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

    // Cache for fast access
    *state.cached_app.lock().unwrap() = Some(app.clone());
    *state.jwt_secret.lock().unwrap() = remote.auth.secret.clone();

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
                    // Forward to terminal-specific WS clients
                    if let Some(senders) = clients.get(&term_id) {
                        for tx in senders {
                            let _ = tx.send(data.clone());
                        }
                    }
                    // Forward to sync clients (full UI mirror)
                    if let Some(sync_senders) = clients.get("__sync__") {
                        let msg = serde_json::json!({
                            "type": "terminal:data",
                            "id": term_id,
                            "data": data
                        }).to_string();
                        for tx in sync_senders {
                            let _ = tx.send(msg.clone());
                        }
                    }
                }
            }
        }
    });

    // Listen for terminal:exit events
    let ws_state_exit = state.inner.clone();
    let _exit_listener = app.listen("terminal:exit", move |event| {
        let payload = event.payload();
        if let Ok(term_id) = serde_json::from_str::<String>(payload) {
            if let Ok(ws_clients) = ws_state_exit.try_lock() {
                if let Ok(clients) = ws_clients.ws_clients.lock() {
                    // Notify sync clients
                    if let Some(sync_senders) = clients.get("__sync__") {
                        let msg = serde_json::json!({
                            "type": "terminal:exit",
                            "id": term_id
                        }).to_string();
                        for tx in sync_senders {
                            let _ = tx.send(msg.clone());
                        }
                    }
                }
            }
        }
    });

    // Start the HTTP/WS server in a background task
    tokio::spawn(async move {
        let app_state = shared_state.clone();

        // Resolve the frontend dist directory
        // In dev: relative to exe; in production: next to the exe
        let frontend_dir = resolve_frontend_dir();

        let api_routes = Router::new()
            .route("/api/auth", post(handle_auth))
            .route("/api/terminals", get(list_terminals))
            .route("/api/terminal/create", post(create_terminal_handler))
            .route("/api/terminal/create-command", post(create_command_handler))
            .route("/api/terminal/create-ssh", post(create_ssh_handler))
            .route("/api/terminal/{id}/close", post(close_terminal_handler))
            .route("/api/projects", get(list_projects).post(add_project))
            .route("/api/projects/update", post(update_project))
            .route("/api/projects/reorder", post(reorder_projects))
            .route("/api/projects/{id}", axum::routing::delete(delete_project))
            .route("/api/settings", get(get_settings).post(set_settings))
            .route("/api/settings/shells", get(get_shells))
            .route("/api/settings/default-shell", get(get_default_shell))
            .route("/api/workspace", get(get_workspace).post(save_workspace))
            .route("/api/theme", get(get_theme).post(set_theme))
            .route("/api/themes", get(list_themes))
            .route("/api/version", get(get_version))
            .route("/ws/terminal/{id}", get(ws_upgrade))
            .route("/ws/sync", get(ws_sync_upgrade))
            .with_state(app_state);

        // Serve frontend static files with fallback to index.html (SPA)
        let router = if frontend_dir.exists() {
            let serve_dir = ServeDir::new(&frontend_dir)
                .fallback(tower_http::services::ServeFile::new(frontend_dir.join("index.html")));
            api_routes.fallback_service(serve_dir)
        } else {
            // Fallback: serve embedded minimal UI
            api_routes.route("/", get(serve_fallback_index))
        };

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
    *state.jwt_secret.lock().unwrap() = remote.auth.secret.clone();
    Ok(remote.auth.pin.clone())
}

// ─── Axum Handlers ──────────────────────────────────────────────────────────

/// Resolve the frontend dist directory path
fn resolve_frontend_dir() -> std::path::PathBuf {
    // Try relative to executable first (production)
    if let Ok(exe) = std::env::current_exe() {
        let exe_dir = exe.parent().unwrap_or(std::path::Path::new("."));
        // Windows: exe is in the same dir as the frontend
        let candidate = exe_dir.join("dist").join("renderer");
        if candidate.exists() {
            return candidate;
        }
        // Dev mode: relative to project root
        let candidate = exe_dir.join("../../../dist/renderer");
        if candidate.exists() {
            return candidate;
        }
    }
    // Fallback: relative to CWD
    std::path::PathBuf::from("dist/renderer")
}

async fn serve_fallback_index() -> Html<&'static str> {
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

// ─── Auth middleware helper ──────────────────────────────────────────────────

fn extract_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
}

async fn verify_auth(
    state: &Arc<Mutex<RemoteState>>,
    headers: &HeaderMap,
) -> Result<AppHandle, (StatusCode, Json<serde_json::Value>)> {
    let token = extract_token(headers).ok_or((
        StatusCode::UNAUTHORIZED,
        Json(serde_json::json!({ "error": "Unauthorized" })),
    ))?;

    // Fast path: verify token without async lock
    let remote = state.lock().await;
    if !remote.auth.verify_token(token) {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Unauthorized" })),
        ));
    }
    remote.app_handle.clone().ok_or((
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(serde_json::json!({ "error": "App not initialized" })),
    ))
}

// ─── Terminal Handlers ───────────────────────────────────────────────────────

async fn list_terminals(
    State(state): State<Arc<Mutex<RemoteState>>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let app = match verify_auth(&state, &headers).await {
        Ok(a) => a,
        Err(e) => return e.into_response(),
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateTerminalRequest {
    project_path: String,
    shell: Option<String>,
    context: Option<crate::modules::pty::TerminalContext>,
}

async fn create_terminal_handler(
    State(state): State<Arc<Mutex<RemoteState>>>,
    headers: HeaderMap,
    Json(body): Json<CreateTerminalRequest>,
) -> impl IntoResponse {
    let app = match verify_auth(&state, &headers).await {
        Ok(a) => a,
        Err(e) => return e.into_response(),
    };

    match crate::modules::pty::terminal_create(app, body.project_path, body.shell, body.context) {
        Ok(id) => (StatusCode::OK, Json(serde_json::json!(id))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e }))).into_response(),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateCommandRequest {
    project_path: String,
    command: Vec<String>,
    context: Option<crate::modules::pty::TerminalContext>,
}

async fn create_command_handler(
    State(state): State<Arc<Mutex<RemoteState>>>,
    headers: HeaderMap,
    Json(body): Json<CreateCommandRequest>,
) -> impl IntoResponse {
    let app = match verify_auth(&state, &headers).await {
        Ok(a) => a,
        Err(e) => return e.into_response(),
    };

    match crate::modules::pty::terminal_create_command(app, body.project_path, body.command, body.context) {
        Ok(id) => (StatusCode::OK, Json(serde_json::json!(id))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e }))).into_response(),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateSshRequest {
    connection: crate::modules::ssh::SSHConnection,
    password: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
}

async fn create_ssh_handler(
    State(state): State<Arc<Mutex<RemoteState>>>,
    headers: HeaderMap,
    Json(body): Json<CreateSshRequest>,
) -> impl IntoResponse {
    let app = match verify_auth(&state, &headers).await {
        Ok(a) => a,
        Err(e) => return e.into_response(),
    };

    match crate::modules::pty::terminal_create_ssh(app, body.connection, body.password, body.cols, body.rows) {
        Ok(id) => (StatusCode::OK, Json(serde_json::json!(id))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e }))).into_response(),
    }
}

async fn close_terminal_handler(
    State(state): State<Arc<Mutex<RemoteState>>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let app = match verify_auth(&state, &headers).await {
        Ok(a) => a,
        Err(e) => return e.into_response(),
    };

    match crate::modules::pty::terminal_close(app, id) {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!(null))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e }))).into_response(),
    }
}

// ─── Project Handlers ────────────────────────────────────────────────────────

async fn list_projects(
    State(state): State<Arc<Mutex<RemoteState>>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let app = match verify_auth(&state, &headers).await {
        Ok(a) => a,
        Err(e) => return e.into_response(),
    };

    let projects = crate::modules::projects::projects_list(app);
    (StatusCode::OK, Json(serde_json::json!(projects))).into_response()
}

async fn add_project(
    State(state): State<Arc<Mutex<RemoteState>>>,
    headers: HeaderMap,
    Json(project): Json<crate::modules::projects::Project>,
) -> impl IntoResponse {
    let app = match verify_auth(&state, &headers).await {
        Ok(a) => a,
        Err(e) => return e.into_response(),
    };

    let projects = crate::modules::projects::projects_add(app, project);
    (StatusCode::OK, Json(serde_json::json!(projects))).into_response()
}

async fn update_project(
    State(state): State<Arc<Mutex<RemoteState>>>,
    headers: HeaderMap,
    Json(project): Json<crate::modules::projects::Project>,
) -> impl IntoResponse {
    let app = match verify_auth(&state, &headers).await {
        Ok(a) => a,
        Err(e) => return e.into_response(),
    };

    let projects = crate::modules::projects::projects_update(app, project);
    (StatusCode::OK, Json(serde_json::json!(projects))).into_response()
}

#[derive(Deserialize)]
struct ReorderRequest {
    ids: Vec<String>,
}

async fn reorder_projects(
    State(state): State<Arc<Mutex<RemoteState>>>,
    headers: HeaderMap,
    Json(body): Json<ReorderRequest>,
) -> impl IntoResponse {
    let app = match verify_auth(&state, &headers).await {
        Ok(a) => a,
        Err(e) => return e.into_response(),
    };

    let projects = crate::modules::projects::projects_reorder(app, body.ids);
    (StatusCode::OK, Json(serde_json::json!(projects))).into_response()
}

async fn delete_project(
    State(state): State<Arc<Mutex<RemoteState>>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let app = match verify_auth(&state, &headers).await {
        Ok(a) => a,
        Err(e) => return e.into_response(),
    };

    let projects = crate::modules::projects::projects_delete(app, id);
    (StatusCode::OK, Json(serde_json::json!(projects))).into_response()
}

// ─── Settings Handlers ───────────────────────────────────────────────────────

async fn get_settings(
    State(state): State<Arc<Mutex<RemoteState>>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let app = match verify_auth(&state, &headers).await {
        Ok(a) => a,
        Err(e) => return e.into_response(),
    };

    let s = crate::modules::settings::settings_get(app);
    (StatusCode::OK, Json(serde_json::json!(s))).into_response()
}

async fn set_settings(
    State(state): State<Arc<Mutex<RemoteState>>>,
    headers: HeaderMap,
    Json(settings): Json<crate::modules::settings::AppSettings>,
) -> impl IntoResponse {
    let app = match verify_auth(&state, &headers).await {
        Ok(a) => a,
        Err(e) => return e.into_response(),
    };

    let s = crate::modules::settings::settings_set(app, settings);
    (StatusCode::OK, Json(serde_json::json!(s))).into_response()
}

async fn get_shells(
    State(state): State<Arc<Mutex<RemoteState>>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let _ = match verify_auth(&state, &headers).await {
        Ok(a) => a,
        Err(e) => return e.into_response(),
    };

    let shells = crate::modules::settings::settings_get_shells();
    (StatusCode::OK, Json(serde_json::json!(shells))).into_response()
}

async fn get_default_shell(
    State(state): State<Arc<Mutex<RemoteState>>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let app = match verify_auth(&state, &headers).await {
        Ok(a) => a,
        Err(e) => return e.into_response(),
    };

    let shell = crate::modules::settings::settings_get_default_shell(app);
    (StatusCode::OK, Json(serde_json::json!(shell))).into_response()
}

// ─── Workspace Handlers ──────────────────────────────────────────────────────

async fn get_workspace(
    State(state): State<Arc<Mutex<RemoteState>>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let app = match verify_auth(&state, &headers).await {
        Ok(a) => a,
        Err(e) => return e.into_response(),
    };

    let ws = crate::modules::workspace::workspace_get_state(app);
    (StatusCode::OK, Json(serde_json::json!(ws))).into_response()
}

async fn save_workspace(
    State(state): State<Arc<Mutex<RemoteState>>>,
    headers: HeaderMap,
    Json(ws_state): Json<crate::modules::workspace::WorkspaceState>,
) -> impl IntoResponse {
    let app = match verify_auth(&state, &headers).await {
        Ok(a) => a,
        Err(e) => return e.into_response(),
    };

    crate::modules::workspace::workspace_save_state(app, ws_state);
    (StatusCode::OK, Json(serde_json::json!(null))).into_response()
}

// ─── Theme Handlers ──────────────────────────────────────────────────────────

async fn get_theme(
    State(state): State<Arc<Mutex<RemoteState>>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let app = match verify_auth(&state, &headers).await {
        Ok(a) => a,
        Err(e) => return e.into_response(),
    };

    let t = crate::modules::theme::theme_get(app);
    (StatusCode::OK, Json(serde_json::json!(t))).into_response()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SetThemeRequest {
    theme_id: String,
}

async fn set_theme(
    State(state): State<Arc<Mutex<RemoteState>>>,
    headers: HeaderMap,
    Json(body): Json<SetThemeRequest>,
) -> impl IntoResponse {
    let app = match verify_auth(&state, &headers).await {
        Ok(a) => a,
        Err(e) => return e.into_response(),
    };

    crate::modules::theme::theme_set(app, body.theme_id);
    (StatusCode::OK, Json(serde_json::json!(null))).into_response()
}

async fn list_themes(
    State(state): State<Arc<Mutex<RemoteState>>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let _ = match verify_auth(&state, &headers).await {
        Ok(a) => a,
        Err(e) => return e.into_response(),
    };

    let themes = crate::modules::theme::theme_list();
    (StatusCode::OK, Json(serde_json::json!(themes))).into_response()
}

// ─── App Handlers ────────────────────────────────────────────────────────────

async fn get_version(
    State(state): State<Arc<Mutex<RemoteState>>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let _ = match verify_auth(&state, &headers).await {
        Ok(a) => a,
        Err(e) => return e.into_response(),
    };

    let version = env!("CARGO_PKG_VERSION").to_string();
    (StatusCode::OK, Json(serde_json::json!(version))).into_response()
}

// ─── WebSocket Handlers ──────────────────────────────────────────────────────

async fn ws_upgrade(
    State(state): State<Arc<Mutex<RemoteState>>>,
    Path(id): Path<String>,
    Query(query): Query<WsQuery>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    let remote = state.lock().await;
    if !remote.auth.verify_token(&query.token) {
        return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
    }
    drop(remote);

    ws.on_upgrade(move |socket| handle_terminal_ws(socket, id, state))
        .into_response()
}

/// Sync WebSocket — streams terminal data and state events to remote clients
async fn ws_sync_upgrade(
    State(state): State<Arc<Mutex<RemoteState>>>,
    Query(query): Query<WsQuery>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    let remote = state.lock().await;
    if !remote.auth.verify_token(&query.token) {
        return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
    }
    drop(remote);

    ws.on_upgrade(move |socket| handle_sync_ws(socket, state))
        .into_response()
}

/// Handle the sync WebSocket — broadcasts all terminal data to this client
async fn handle_sync_ws(
    socket: axum::extract::ws::WebSocket,
    state: Arc<Mutex<RemoteState>>,
) {
    use futures_util::{SinkExt, StreamExt};
    use axum::extract::ws::Message;

    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Create a channel for this sync client
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    // Register as a "sync" client that receives ALL terminal data
    {
        let remote = state.lock().await;
        remote
            .ws_clients
            .lock()
            .unwrap()
            .entry("__sync__".to_string())
            .or_insert_with(Vec::new)
            .push(tx);
    }

    // Forward messages to WebSocket
    let send_task = tokio::spawn(async move {
        while let Some(data) = rx.recv().await {
            if ws_sender.send(Message::Text(data.into())).await.is_err() {
                break;
            }
        }
    });

    // Keep connection alive by reading (handle pings/close)
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_receiver.next().await {
            if matches!(msg, Message::Close(_)) {
                break;
            }
        }
    });

    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }
}
