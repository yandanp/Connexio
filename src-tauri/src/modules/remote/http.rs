use axum::{
    extract::{ws::WebSocketUpgrade, Query, State},
    http::{HeaderMap, StatusCode},
    response::{Html, IntoResponse, Json},
};
use serde::Deserialize;
use std::sync::{Arc, Mutex as StdMutex};

use super::state::{now_secs, RemoteState, LOCKOUT_SECS, MAX_PIN_ATTEMPTS};
use super::websocket::handle_ws_client;

// ─── HTTP Handlers ───────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub(super) struct AuthRequest {
    pin: String,
}

#[derive(Deserialize)]
pub(super) struct WsQueryParams {
    pin: Option<String>,
    token: Option<String>,
}

pub(super) async fn handle_auth(
    State(state): State<Arc<StdMutex<RemoteState>>>,
    Json(body): Json<AuthRequest>,
) -> impl IntoResponse {
    let mut s = state.lock().unwrap();

    // Check lockout
    let now = now_secs();
    if let Some(until) = s.lockout_until {
        if now < until {
            return (
                StatusCode::TOO_MANY_REQUESTS,
                Json(serde_json::json!({
                    "error": format!("Locked out. Try again in {} seconds.", until - now)
                })),
            )
                .into_response();
        }
        s.lockout_until = None;
        s.failed_attempts = 0;
    }

    if body.pin == s.pin {
        s.failed_attempts = 0;
        let token = uuid::Uuid::new_v4().to_string();
        s.trusted_tokens.insert(token.clone());
        (
            StatusCode::OK,
            Json(serde_json::json!({ "ok": true, "token": token })),
        )
            .into_response()
    } else {
        s.failed_attempts += 1;
        if s.failed_attempts >= MAX_PIN_ATTEMPTS {
            s.lockout_until = Some(now + LOCKOUT_SECS);
            (
                StatusCode::TOO_MANY_REQUESTS,
                Json(serde_json::json!({
                    "error": "Too many attempts. Locked for 5 minutes."
                })),
            )
                .into_response()
        } else {
            let remaining = MAX_PIN_ATTEMPTS - s.failed_attempts;
            (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({
                    "error": format!("Invalid PIN. {} attempts left.", remaining)
                })),
            )
                .into_response()
        }
    }
}

pub(super) async fn ws_upgrade(
    State(state): State<Arc<StdMutex<RemoteState>>>,
    Query(params): Query<WsQueryParams>,
    headers: HeaderMap,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    // Verify PIN or trusted token
    {
        let s = state.lock().unwrap();
        let pin_ok = params.pin.as_ref().is_some_and(|pin| pin == &s.pin);
        let token_ok = params
            .token
            .as_ref()
            .is_some_and(|token| s.trusted_tokens.contains(token));
        if !pin_ok && !token_ok {
            return (StatusCode::UNAUTHORIZED, "Invalid PIN or token").into_response();
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

pub(super) async fn serve_fallback() -> Html<&'static str> {
    Html(include_str!("../../../remote-ui/index.html"))
}

pub(super) fn resolve_frontend_dir() -> std::path::PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        let dir = exe.parent().unwrap_or(std::path::Path::new("."));
        let candidate = dir.join("dist").join("renderer");
        if candidate.exists() {
            return candidate;
        }
        let candidate = dir.join("../../../dist/renderer");
        if candidate.exists() {
            return candidate;
        }
    }
    std::path::PathBuf::from("dist/renderer")
}
