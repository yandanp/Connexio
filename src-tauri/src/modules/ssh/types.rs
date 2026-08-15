use serde::{Deserialize, Serialize};

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
