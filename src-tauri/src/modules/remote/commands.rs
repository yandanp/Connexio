use tauri::{AppHandle, Manager};

use super::server::{listen_terminal_events, spawn_http_server, start_output_flush_loop};
use super::state::{generate_pin, RemoteAccessState, RemoteClientInfo, DEFAULT_PORT};
use super::tailscale::detect_tailscale_ip;
use super::wol::send_magic_packet;

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
    pub login_url: Option<String>,
    pub tailscale_ip: Option<String>,
    pub tailscale_login_url: Option<String>,
}

#[tauri::command]
pub async fn remote_start(
    app: AppHandle,
    port: Option<u16>,
) -> Result<RemoteStatusResponse, String> {
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

    start_output_flush_loop(state.inner.clone());
    listen_terminal_events(&app, state.inner.clone());
    spawn_http_server(state.inner.clone(), port, shutdown_rx);

    let local_ip = local_ip_address::local_ip().ok().map(|ip| ip.to_string());
    let tailscale_ip = detect_tailscale_ip();
    let s = state.inner.lock().unwrap();

    let login_url = local_ip
        .clone()
        .map(|ip| format!("http://{}:{}?pin={}", ip, port, s.pin));
    let tailscale_login_url = tailscale_ip
        .clone()
        .map(|ip| format!("http://{}:{}?pin={}", ip, port, s.pin));

    Ok(RemoteStatusResponse {
        is_running: true,
        port,
        pin: s.pin.clone(),
        local_ip,
        connected_clients: s.clients.len(),
        clients: s.client_info.values().cloned().collect(),
        login_url,
        tailscale_ip,
        tailscale_login_url,
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
    let tailscale_ip = detect_tailscale_ip();

    let login_url = local_ip
        .clone()
        .map(|ip| format!("http://{}:{}?pin={}", ip, s.port, s.pin));
    let tailscale_login_url = tailscale_ip
        .clone()
        .map(|ip| format!("http://{}:{}?pin={}", ip, s.port, s.pin));

    Ok(RemoteStatusResponse {
        is_running: s.is_running,
        port: s.port,
        pin: s.pin.clone(),
        local_ip,
        connected_clients: s.clients.len(),
        clients: s.client_info.values().cloned().collect(),
        login_url,
        tailscale_ip,
        tailscale_login_url,
    })
}

#[tauri::command]
pub async fn remote_wol_send(
    mac: String,
    broadcast_ip: Option<String>,
    port: Option<u16>,
) -> Result<(), String> {
    send_magic_packet(
        &mac,
        &broadcast_ip.unwrap_or_else(|| "255.255.255.255".to_string()),
        port.unwrap_or(9),
    )
}

#[tauri::command]
pub async fn remote_regenerate_pin(app: AppHandle) -> Result<String, String> {
    let state = app.state::<RemoteAccessState>();
    let mut s = state.inner.lock().unwrap();
    s.pin = generate_pin();
    s.trusted_tokens.clear();
    s.failed_attempts = 0;
    s.lockout_until = None;
    Ok(s.pin.clone())
}
