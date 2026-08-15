use ssh2::Session;
use std::process::Command;
use tauri::AppHandle;

use super::storage::{ssh_load_known_hosts, ssh_save_known_hosts};
use super::types::{SSHHostTrustStatus, SSHKnownHost};

pub(super) fn ssh_host_fingerprint(session: &Session) -> Option<String> {
    let (hash, _) = session.host_key()?;
    Some(
        hash.iter()
            .map(|byte| format!("{:02x}", byte))
            .collect::<Vec<_>>()
            .join(":"),
    )
}

pub(super) fn ssh_host_trust_status(
    app: &AppHandle,
    host: &str,
    port: u16,
    fingerprint: Option<&str>,
) -> SSHHostTrustStatus {
    let Some(fingerprint) = fingerprint else {
        return SSHHostTrustStatus::Unknown;
    };
    let known_hosts = ssh_load_known_hosts(app);
    match known_hosts
        .iter()
        .find(|entry| entry.host == host && entry.port == port)
    {
        Some(entry) if entry.fingerprint_sha256 == fingerprint => SSHHostTrustStatus::Trusted,
        Some(_) => SSHHostTrustStatus::Changed,
        None => SSHHostTrustStatus::Unknown,
    }
}

fn chrono_like_timestamp() -> String {
    match std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) {
        Ok(duration) => duration.as_secs().to_string(),
        Err(_) => "0".to_string(),
    }
}

#[tauri::command]
pub fn ssh_known_hosts_list(app: AppHandle) -> Vec<SSHKnownHost> {
    ssh_load_known_hosts(&app)
}

#[tauri::command]
pub fn ssh_trust_host(
    app: AppHandle,
    host: String,
    port: u16,
    fingerprint_sha256: String,
) -> Result<(), String> {
    let mut known_hosts = ssh_load_known_hosts(&app);
    known_hosts.retain(|entry| !(entry.host == host && entry.port == port));
    known_hosts.push(SSHKnownHost {
        host,
        port,
        fingerprint_sha256,
        trusted_at: chrono_like_timestamp(),
    });
    ssh_save_known_hosts(&app, &known_hosts)
}

#[tauri::command]
pub fn ssh_forget_host(app: AppHandle, host: String, port: u16) -> Result<(), String> {
    let mut known_hosts = ssh_load_known_hosts(&app);
    known_hosts.retain(|entry| !(entry.host == host && entry.port == port));
    ssh_save_known_hosts(&app, &known_hosts)
}

#[tauri::command]
pub fn ssh_forget_openssh_host(host: String, port: u16) -> Result<String, String> {
    let target = if port == 22 {
        host
    } else {
        format!("[{}]:{}", host, port)
    };

    let output = Command::new("ssh-keygen")
        .arg("-R")
        .arg(&target)
        .output()
        .map_err(|err| format!("Failed to run ssh-keygen: {}", err))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Ok(if stdout.is_empty() { stderr } else { stdout })
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}
