use rand::Rng;
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex as StdMutex};
use tauri::AppHandle;
use tokio::sync::mpsc;

// ─── Constants ───────────────────────────────────────────────────────────────

pub(super) const DEFAULT_PORT: u16 = 9876;
pub(super) const PIN_LENGTH: usize = 6;
pub(super) const MAX_PIN_ATTEMPTS: u32 = 5;
pub(super) const LOCKOUT_SECS: u64 = 300;
pub(super) const OUTPUT_BUFFER_INTERVAL_MS: u64 = 16; // 60fps
pub(super) const OUTPUT_FLUSH_THRESHOLD: usize = 32768; // flush immediately if buffer > 32KB

// ─── State ───────────────────────────────────────────────────────────────────

/// Per-client sender for multiplexed messages
pub(super) type ClientSender = mpsc::UnboundedSender<String>;

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteClientInfo {
    pub id: String,
    pub user_agent: String,
    pub connected_at: u64,
}

pub struct RemoteState {
    pub(super) pin: String,
    pub(super) app_handle: Option<AppHandle>,
    pub(super) port: u16,
    pub(super) is_running: bool,
    pub(super) failed_attempts: u32,
    pub(super) lockout_until: Option<u64>,
    /// All connected clients (client_id → sender)
    pub(super) clients: HashMap<String, ClientSender>,
    pub(super) client_info: HashMap<String, RemoteClientInfo>,
    pub(super) trusted_tokens: HashSet<String>,
    /// Terminal output buffers: term_id → accumulated output
    /// Flushed to all clients at 60fps
    pub(super) output_buffers: HashMap<String, String>,
    pub(super) shutdown_tx: Option<tokio::sync::oneshot::Sender<()>>,
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
            trusted_tokens: HashSet::new(),
            output_buffers: HashMap::new(),
            shutdown_tx: None,
        }
    }

    pub(super) fn broadcast(&self, msg: &str) {
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

pub(super) fn generate_pin() -> String {
    let mut rng = rand::thread_rng();
    format!(
        "{:0>width$}",
        rng.gen_range(0..10u32.pow(PIN_LENGTH as u32)),
        width = PIN_LENGTH
    )
}

pub(super) fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_pin_has_expected_length_and_digits() {
        let pin = generate_pin();
        assert_eq!(pin.len(), PIN_LENGTH);
        assert!(pin.chars().all(|c| c.is_ascii_digit()));
    }
}
