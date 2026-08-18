use axum::{
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use std::sync::{Arc, Mutex as StdMutex};
use tauri::{AppHandle, Listener};
use tokio::sync::oneshot;
use tokio::time::{interval, Duration};
use tower_http::services::{ServeDir, ServeFile};

use super::http::{handle_auth, resolve_frontend_dir, serve_fallback, ws_upgrade};
use super::protocol::ServerMessage;
use super::state::{RemoteState, OUTPUT_BUFFER_INTERVAL_MS, OUTPUT_FLUSH_THRESHOLD};

// ─── Server Runtime ──────────────────────────────────────────────────────────

/// Output flush loop: broadcasts buffered terminal output at 60fps.
pub(super) fn start_output_flush_loop(state: Arc<StdMutex<RemoteState>>) {
    tokio::spawn(async move {
        let mut tick = interval(Duration::from_millis(OUTPUT_BUFFER_INTERVAL_MS));
        tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            tick.tick().await;
            let mut s = state.lock().unwrap();
            if !s.is_running {
                break;
            }
            // Flush all terminal output buffers
            let buffers: Vec<(String, String)> = s
                .output_buffers
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
}

/// Listen for terminal:data / terminal:exit events → buffer/broadcast output.
pub(super) fn listen_terminal_events(app: &AppHandle, state: Arc<StdMutex<RemoteState>>) {
    let data_state = state.clone();
    let _data_listener = app.listen("terminal:data", move |event| {
        let payload = event.payload();
        if let Ok((term_id, data)) = serde_json::from_str::<(String, String)>(payload) {
            let mut s = data_state.lock().unwrap();
            let buffer = s.output_buffers.entry(term_id.clone()).or_default();
            buffer.push_str(&data);
            // Flush immediately if buffer is large
            if buffer.len() > OUTPUT_FLUSH_THRESHOLD {
                let flushed = std::mem::take(buffer);
                let msg = ServerMessage::Term {
                    id: term_id,
                    data: flushed,
                };
                let json = msg.to_json();
                s.broadcast(&json);
            }
        }
    });

    let exit_state = state.clone();
    let _exit_listener = app.listen("terminal:exit", move |event| {
        let payload = event.payload();
        if let Ok(term_id) = serde_json::from_str::<String>(payload) {
            let mut s = exit_state.lock().unwrap();
            // Retire any buffered output so a reused terminal id never
            // receives stale data from its previous incarnation.
            s.output_buffers.remove(&term_id);
            let msg = ServerMessage::TermExit { id: term_id };
            s.broadcast(&msg.to_json());
        }
    });
}

/// Start the HTTP/WS server with graceful shutdown.
pub(super) fn spawn_http_server(
    state: Arc<StdMutex<RemoteState>>,
    port: u16,
    shutdown_rx: oneshot::Receiver<()>,
) {
    tokio::spawn(async move {
        let frontend_dir = resolve_frontend_dir();

        let app_routes = Router::new()
            .route("/api/auth", post(handle_auth))
            .route("/ws", get(ws_upgrade))
            .with_state(state.clone());

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
            .with_graceful_shutdown(async {
                let _ = shutdown_rx.await;
            })
            .await
            .unwrap_or_else(|e| log::error!("Remote server error: {}", e));

        log::info!("Remote access server stopped");
    });
}
