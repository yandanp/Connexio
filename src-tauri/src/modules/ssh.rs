use keyring::Entry;
use serde::{Deserialize, Serialize};
use ssh2::Session;
use std::fs;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;
use tauri::{AppHandle, Manager};

fn data_dir(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn ssh_file(app: &AppHandle, project_id: &str) -> PathBuf {
    data_dir(app).join("ssh").join(format!("{}.json", project_id))
}

fn ssh_global_file(app: &AppHandle) -> PathBuf {
    data_dir(app).join("ssh_global.json")
}

fn ssh_known_hosts_file(app: &AppHandle) -> PathBuf {
    data_dir(app).join("ssh_known_hosts.json")
}

const KEYRING_SERVICE: &str = "connexio.ssh";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SSHConnection {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: SSHAuthMethod,
    pub private_key_path: Option<String>,
    pub color: Option<String>,
    #[serde(default)]
    pub folder: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub identity_id: Option<String>,
    #[serde(default)]
    pub password_secret_ref: Option<SSHSecretRef>,
    #[serde(default)]
    pub passphrase_secret_ref: Option<SSHSecretRef>,
    #[serde(default)]
    pub startup_commands: Vec<String>,
    #[serde(default)]
    pub keep_alive_secs: Option<u16>,
    #[serde(default)]
    pub tunnels: Vec<SSHTunnelConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SSHAuthMethod {
    Password,
    Key,
    Agent,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SSHIdentity {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub private_key_path: Option<String>,
    #[serde(default)]
    pub private_key_secret_ref: Option<SSHSecretRef>,
    #[serde(default)]
    pub passphrase_secret_ref: Option<SSHSecretRef>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SSHSecretRef {
    pub provider: SSHSecretProvider,
    pub key: String,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SSHSecretProvider {
    Keychain,
    Vault,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SSHConnectionTestResult {
    pub success: bool,
    pub message: String,
    #[serde(default)]
    pub fingerprint_sha256: Option<String>,
    #[serde(default)]
    pub authenticated: bool,
    pub host_trust: SSHHostTrustStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SSHKnownHost {
    pub host: String,
    pub port: u16,
    pub fingerprint_sha256: String,
    pub trusted_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SSHHostTrustStatus {
    Unknown,
    Trusted,
    Changed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SFTPEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    #[serde(default)]
    pub size: Option<u64>,
    #[serde(default)]
    pub modified_time: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SSHTunnelConfig {
    pub id: String,
    pub tunnel_type: SSHTunnelType,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub local_host: Option<String>,
    #[serde(default)]
    pub local_port: Option<u16>,
    #[serde(default)]
    pub remote_host: Option<String>,
    #[serde(default)]
    pub remote_port: Option<u16>,
    #[serde(default)]
    pub auto_start: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SSHTunnelType {
    Local,
    Remote,
    Dynamic,
}

#[tauri::command]
pub fn ssh_list(app: AppHandle, project_id: String) -> Vec<SSHConnection> {
    let path = ssh_file(&app, &project_id);
    if !path.exists() {
        return vec![];
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default()
}

#[tauri::command]
pub fn ssh_save(app: AppHandle, project_id: String, connections: Vec<SSHConnection>) {
    let path = ssh_file(&app, &project_id);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(&connections).unwrap_or_default();
    let _ = fs::write(&path, json);
}

#[tauri::command]
pub fn ssh_list_global(app: AppHandle) -> Vec<SSHConnection> {
    let path = ssh_global_file(&app);
    if !path.exists() {
        return vec![];
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default()
}

#[tauri::command]
pub fn ssh_save_global(app: AppHandle, connections: Vec<SSHConnection>) {
    let path = ssh_global_file(&app);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(&connections).unwrap_or_default();
    let _ = fs::write(&path, json);
}

fn shell_quote(value: &str) -> String {
    if value
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.' | '/' | ':' | '@' | '\\'))
    {
        return value.to_string();
    }

    #[cfg(target_os = "windows")]
    {
        format!("\"{}\"", value.replace('"', "\\\""))
    }

    #[cfg(not(target_os = "windows"))]
    {
        format!("'{}'", value.replace('\'', "'\\''"))
    }
}

#[tauri::command]
pub fn ssh_build_command(connection: SSHConnection) -> String {
    let mut parts = vec!["ssh".to_string()];

    if connection.port != 22 {
        parts.push("-p".to_string());
        parts.push(connection.port.to_string());
    }

    if connection.auth_method == SSHAuthMethod::Key {
        if let Some(ref key_path) = connection.private_key_path {
            parts.push("-i".to_string());
            parts.push(shell_quote(key_path));
        }
    }

    if let Some(keep_alive_secs) = connection.keep_alive_secs {
        parts.push("-o".to_string());
        parts.push(format!("ServerAliveInterval={}", keep_alive_secs));
    }

    parts.push(format!(
        "{}@{}",
        shell_quote(&connection.username),
        shell_quote(&connection.host)
    ));

    let mut command = parts.join(" ");
    for startup_command in connection.startup_commands.iter().filter(|cmd| !cmd.trim().is_empty()) {
        command.push_str(" && ");
        command.push_str(startup_command.trim());
    }

    command
}

#[tauri::command]
pub fn ssh_build_command_args(connection: SSHConnection) -> Vec<String> {
    let mut args = vec!["ssh".to_string()];

    if connection.port != 22 {
        args.push("-p".to_string());
        args.push(connection.port.to_string());
    }

    if connection.auth_method == SSHAuthMethod::Key {
        if let Some(ref key_path) = connection.private_key_path {
            args.push("-i".to_string());
            args.push(key_path.clone());
        }
    }

    if let Some(keep_alive_secs) = connection.keep_alive_secs {
        args.push("-o".to_string());
        args.push(format!("ServerAliveInterval={}", keep_alive_secs));
    }

    args.push(format!("{}@{}", connection.username, connection.host));
    args
}

fn ssh_host_fingerprint(session: &Session) -> Option<String> {
    let (hash, _) = session.host_key()?;
    Some(hash.iter().map(|byte| format!("{:02x}", byte)).collect::<Vec<_>>().join(":"))
}

fn ssh_load_known_hosts(app: &AppHandle) -> Vec<SSHKnownHost> {
    let path = ssh_known_hosts_file(app);
    if !path.exists() {
        return vec![];
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
        .unwrap_or_default()
}

fn ssh_save_known_hosts(app: &AppHandle, hosts: &[SSHKnownHost]) -> Result<(), String> {
    let path = ssh_known_hosts_file(app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| format!("Failed to create SSH data dir: {}", err))?;
    }
    let json = serde_json::to_string_pretty(hosts).map_err(|err| format!("Failed to serialize known hosts: {}", err))?;
    fs::write(&path, json).map_err(|err| format!("Failed to save known hosts: {}", err))
}

fn ssh_host_trust_status(app: &AppHandle, host: &str, port: u16, fingerprint: Option<&str>) -> SSHHostTrustStatus {
    let Some(fingerprint) = fingerprint else {
        return SSHHostTrustStatus::Unknown;
    };
    let known_hosts = ssh_load_known_hosts(app);
    match known_hosts.iter().find(|entry| entry.host == host && entry.port == port) {
        Some(entry) if entry.fingerprint_sha256 == fingerprint => SSHHostTrustStatus::Trusted,
        Some(_) => SSHHostTrustStatus::Changed,
        None => SSHHostTrustStatus::Unknown,
    }
}

#[tauri::command]
pub fn ssh_known_hosts_list(app: AppHandle) -> Vec<SSHKnownHost> {
    ssh_load_known_hosts(&app)
}

#[tauri::command]
pub fn ssh_trust_host(app: AppHandle, host: String, port: u16, fingerprint_sha256: String) -> Result<(), String> {
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

fn chrono_like_timestamp() -> String {
    match std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) {
        Ok(duration) => duration.as_secs().to_string(),
        Err(_) => "0".to_string(),
    }
}

#[tauri::command]
pub fn ssh_test_connection(app: AppHandle, connection: SSHConnection, password: Option<String>) -> SSHConnectionTestResult {
    let address = format!("{}:{}", connection.host, connection.port);
    let tcp = match TcpStream::connect(&address) {
        Ok(tcp) => tcp,
        Err(err) => {
            return SSHConnectionTestResult {
                success: false,
                message: format!("Failed to connect to {}: {}", address, err),
                fingerprint_sha256: None,
                authenticated: false,
                host_trust: SSHHostTrustStatus::Unknown,
            };
        }
    };
    let _ = tcp.set_read_timeout(Some(Duration::from_secs(15)));
    let _ = tcp.set_write_timeout(Some(Duration::from_secs(15)));

    let mut session = match Session::new() {
        Ok(session) => session,
        Err(err) => {
            return SSHConnectionTestResult {
                success: false,
                message: format!("Failed to create SSH session: {}", err),
                fingerprint_sha256: None,
                authenticated: false,
                host_trust: SSHHostTrustStatus::Unknown,
            };
        }
    };
    session.set_timeout(30_000);
    session.set_tcp_stream(tcp);
    if let Err(err) = session.handshake() {
        return SSHConnectionTestResult {
            success: false,
            message: format!("SSH handshake failed: {}", err),
            fingerprint_sha256: ssh_host_fingerprint(&session),
            authenticated: false,
            host_trust: SSHHostTrustStatus::Unknown,
        };
    }

    let fingerprint_sha256 = ssh_host_fingerprint(&session);
    let host_trust = ssh_host_trust_status(&app, &connection.host, connection.port, fingerprint_sha256.as_deref());
    let auth_result = match connection.auth_method {
        SSHAuthMethod::Password => match password {
            Some(password) if !password.is_empty() => session.userauth_password(&connection.username, &password),
            _ => Err(ssh2::Error::from_errno(ssh2::ErrorCode::Session(-18))),
        },
        SSHAuthMethod::Key => {
            let key_path = match connection.private_key_path.as_deref() {
                Some(path) if !path.trim().is_empty() => PathBuf::from(path),
                _ => {
                    return SSHConnectionTestResult {
                        success: false,
                        message: "Private key path is required".to_string(),
                        fingerprint_sha256,
                        authenticated: false,
                        host_trust: host_trust.clone(),
                    };
                }
            };
            session.userauth_pubkey_file(&connection.username, None, &key_path, password.as_deref())
        }
        SSHAuthMethod::Agent => match session.agent() {
            Ok(mut agent) => {
                if let Err(err) = agent.connect() {
                    return SSHConnectionTestResult {
                        success: false,
                        message: format!("Failed to connect to SSH agent: {}", err),
                        fingerprint_sha256,
                        authenticated: false,
                        host_trust: host_trust.clone(),
                    };
                }
                if let Err(err) = agent.list_identities() {
                    return SSHConnectionTestResult {
                        success: false,
                        message: format!("Failed to list SSH agent identities: {}", err),
                        fingerprint_sha256,
                        authenticated: false,
                        host_trust: host_trust.clone(),
                    };
                }
                let identities = match agent.identities() {
                    Ok(identities) => identities,
                    Err(err) => {
                        return SSHConnectionTestResult {
                            success: false,
                            message: format!("Failed to read SSH agent identities: {}", err),
                            fingerprint_sha256,
                            authenticated: false,
                            host_trust: host_trust.clone(),
                        };
                    }
                };
                let mut last_error = None;
                for identity in identities {
                    match agent.userauth(&connection.username, &identity) {
                        Ok(()) => {
                            last_error = None;
                            break;
                        }
                        Err(err) => last_error = Some(err),
                    }
                }
                match last_error {
                    Some(err) => Err(err),
                    None if session.authenticated() => Ok(()),
                    None => Err(ssh2::Error::from_errno(ssh2::ErrorCode::Session(-18))),
                }
            }
            Err(err) => Err(err),
        },
    };

    match auth_result {
        Ok(()) if session.authenticated() => SSHConnectionTestResult {
            success: true,
            message: "Connection successful".to_string(),
            fingerprint_sha256,
            authenticated: true,
            host_trust,
        },
        Ok(()) => SSHConnectionTestResult {
            success: false,
            message: "Authentication did not complete".to_string(),
            fingerprint_sha256,
            authenticated: false,
            host_trust,
        },
        Err(err) => SSHConnectionTestResult {
            success: false,
            message: format!("Authentication failed: {}", err),
            fingerprint_sha256,
            authenticated: false,
            host_trust,
        },
    }
}

pub(crate) fn ssh_connect_session(connection: &SSHConnection, password: Option<&str>) -> Result<Session, String> {
    let address = format!("{}:{}", connection.host, connection.port);
    let tcp = TcpStream::connect(&address)
        .map_err(|err| format!("Failed to connect to {}: {}", address, err))?;
    let _ = tcp.set_read_timeout(Some(Duration::from_secs(30)));
    let _ = tcp.set_write_timeout(Some(Duration::from_secs(30)));

    let mut session = Session::new()
        .map_err(|err| format!("Failed to create SSH session: {}", err))?;
    session.set_timeout(30_000);
    session.set_tcp_stream(tcp);
    session.handshake().map_err(|err| format!("SSH handshake failed: {}", err))?;

    match connection.auth_method {
        SSHAuthMethod::Password => {
            let password = password.ok_or_else(|| "Password is required".to_string())?;
            session.userauth_password(&connection.username, password)
                .map_err(|err| format!("Password authentication failed: {}", err))?;
        }
        SSHAuthMethod::Key => {
            let key_path = connection.private_key_path.as_deref()
                .filter(|path| !path.trim().is_empty())
                .ok_or_else(|| "Private key path is required".to_string())?;
            session.userauth_pubkey_file(
                &connection.username,
                None,
                Path::new(key_path),
                password,
            ).map_err(|err| format!("Private key authentication failed: {}", err))?;
        }
        SSHAuthMethod::Agent => {
            let mut agent = session.agent().map_err(|err| format!("Failed to open SSH agent: {}", err))?;
            agent.connect().map_err(|err| format!("Failed to connect to SSH agent: {}", err))?;
            agent.list_identities().map_err(|err| format!("Failed to list SSH agent identities: {}", err))?;
            let identities = agent.identities().map_err(|err| format!("Failed to read SSH agent identities: {}", err))?;
            let mut authenticated = false;
            let mut last_error = None;
            for identity in identities {
                match agent.userauth(&connection.username, &identity) {
                    Ok(()) => {
                        authenticated = session.authenticated();
                        if authenticated {
                            break;
                        }
                    }
                    Err(err) => last_error = Some(err),
                }
            }
            if !authenticated {
                return Err(match last_error {
                    Some(err) => format!("SSH agent authentication failed: {}", err),
                    None => "SSH agent authentication failed: no usable identities".to_string(),
                });
            }
        }
    }

    if !session.authenticated() {
        return Err("Authentication did not complete".to_string());
    }

    Ok(session)
}

#[tauri::command]
pub fn ssh_sftp_list(connection: SSHConnection, path: String, password: Option<String>) -> Result<Vec<SFTPEntry>, String> {
    let session = ssh_connect_session(&connection, password.as_deref())?;
    let sftp = session.sftp().map_err(|err| format!("Failed to open SFTP session: {}", err))?;
    let entries = sftp.readdir(Path::new(&path)).map_err(|err| format!("Failed to list remote directory: {}", err))?;

    let mut result = entries
        .into_iter()
        .filter_map(|(entry_path, stat)| {
            let name = entry_path.file_name()?.to_string_lossy().to_string();
            if name == "." || name == ".." {
                return None;
            }
            let full_path = if path.ends_with('/') {
                format!("{}{}", path, name)
            } else {
                format!("{}/{}", path, name)
            };
            Some(SFTPEntry {
                name,
                path: full_path,
                is_dir: stat.is_dir(),
                size: stat.size,
                modified_time: stat.mtime,
            })
        })
        .collect::<Vec<_>>();
    result.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    Ok(result)
}

#[tauri::command]
pub fn ssh_sftp_read(connection: SSHConnection, path: String, password: Option<String>) -> Result<String, String> {
    let session = ssh_connect_session(&connection, password.as_deref())?;
    let sftp = session.sftp().map_err(|err| format!("Failed to open SFTP session: {}", err))?;
    let mut file = sftp.open(Path::new(&path)).map_err(|err| format!("Failed to open remote file: {}", err))?;
    let mut content = String::new();
    file.read_to_string(&mut content).map_err(|err| format!("Failed to read remote file as UTF-8: {}", err))?;
    Ok(content)
}

#[tauri::command]
pub fn ssh_sftp_write(connection: SSHConnection, path: String, content: String, password: Option<String>) -> Result<(), String> {
    let session = ssh_connect_session(&connection, password.as_deref())?;
    let sftp = session.sftp().map_err(|err| format!("Failed to open SFTP session: {}", err))?;
    let mut file = sftp.create(Path::new(&path)).map_err(|err| format!("Failed to create remote file: {}", err))?;
    file.write_all(content.as_bytes()).map_err(|err| format!("Failed to write remote file: {}", err))
}

#[tauri::command]
pub fn ssh_sftp_mkdir(connection: SSHConnection, path: String, password: Option<String>) -> Result<(), String> {
    let session = ssh_connect_session(&connection, password.as_deref())?;
    let sftp = session.sftp().map_err(|err| format!("Failed to open SFTP session: {}", err))?;
    sftp.mkdir(Path::new(&path), 0o755).map_err(|err| format!("Failed to create remote directory: {}", err))
}

#[tauri::command]
pub fn ssh_sftp_delete(connection: SSHConnection, path: String, is_dir: bool, password: Option<String>) -> Result<(), String> {
    let session = ssh_connect_session(&connection, password.as_deref())?;
    let sftp = session.sftp().map_err(|err| format!("Failed to open SFTP session: {}", err))?;
    if is_dir {
        sftp.rmdir(Path::new(&path)).map_err(|err| format!("Failed to remove remote directory: {}", err))
    } else {
        sftp.unlink(Path::new(&path)).map_err(|err| format!("Failed to remove remote file: {}", err))
    }
}

#[tauri::command]
pub fn ssh_sftp_rename(connection: SSHConnection, old_path: String, new_path: String, password: Option<String>) -> Result<(), String> {
    let session = ssh_connect_session(&connection, password.as_deref())?;
    let sftp = session.sftp().map_err(|err| format!("Failed to open SFTP session: {}", err))?;
    sftp.rename(Path::new(&old_path), Path::new(&new_path), None).map_err(|err| format!("Failed to rename remote path: {}", err))
}

#[tauri::command]
pub fn ssh_secret_set(key: String, value: String) -> Result<(), String> {
    Entry::new(KEYRING_SERVICE, &key)
        .map_err(|err| format!("Failed to open keychain entry: {}", err))?
        .set_password(&value)
        .map_err(|err| format!("Failed to save secret: {}", err))
}

#[tauri::command]
pub fn ssh_secret_get(key: String) -> Result<Option<String>, String> {
    match Entry::new(KEYRING_SERVICE, &key)
        .map_err(|err| format!("Failed to open keychain entry: {}", err))?
        .get_password()
    {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(format!("Failed to read secret: {}", err)),
    }
}

#[tauri::command]
pub fn ssh_secret_delete(key: String) -> Result<(), String> {
    match Entry::new(KEYRING_SERVICE, &key)
        .map_err(|err| format!("Failed to open keychain entry: {}", err))?
        .delete_credential()
    {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(format!("Failed to delete secret: {}", err)),
    }
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

#[tauri::command]
pub fn ssh_key_exists(key_path: String) -> bool {
    std::path::Path::new(&key_path).exists()
}
