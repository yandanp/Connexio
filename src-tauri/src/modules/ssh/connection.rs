use ssh2::Session;
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::AppHandle;

use super::trust::{ssh_host_fingerprint, ssh_host_trust_status};
use super::types::{SSHAuthMethod, SSHConnection, SSHConnectionTestResult, SSHHostTrustStatus};

#[tauri::command]
pub fn ssh_test_connection(
    app: AppHandle,
    connection: SSHConnection,
    password: Option<String>,
) -> SSHConnectionTestResult {
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
    let host_trust = ssh_host_trust_status(
        &app,
        &connection.host,
        connection.port,
        fingerprint_sha256.as_deref(),
    );
    let auth_result = match connection.auth_method {
        SSHAuthMethod::Password => match password {
            Some(password) if !password.is_empty() => {
                session.userauth_password(&connection.username, &password)
            }
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

pub(crate) fn ssh_connect_session(
    connection: &SSHConnection,
    password: Option<&str>,
) -> Result<Session, String> {
    let address = format!("{}:{}", connection.host, connection.port);
    let socket_addr: std::net::SocketAddr = address
        .parse()
        .or_else(|_| {
            // Host might be a hostname, resolve it
            use std::net::ToSocketAddrs;
            address
                .to_socket_addrs()
                .map_err(|e| format!("Failed to resolve {}: {}", address, e))?
                .next()
                .ok_or_else(|| format!("No addresses found for {}", address))
        })
        .map_err(|e| format!("Invalid address {}: {}", address, e))?;
    let tcp = TcpStream::connect_timeout(&socket_addr, Duration::from_secs(10))
        .map_err(|err| format!("Failed to connect to {}: {}", address, err))?;
    let _ = tcp.set_read_timeout(Some(Duration::from_secs(15)));
    let _ = tcp.set_write_timeout(Some(Duration::from_secs(15)));

    let mut session =
        Session::new().map_err(|err| format!("Failed to create SSH session: {}", err))?;
    session.set_timeout(15_000);
    session.set_tcp_stream(tcp);
    session
        .handshake()
        .map_err(|err| format!("SSH handshake failed: {}", err))?;

    match connection.auth_method {
        SSHAuthMethod::Password => {
            let password = password.ok_or_else(|| "Password is required".to_string())?;
            session
                .userauth_password(&connection.username, password)
                .map_err(|err| format!("Password authentication failed: {}", err))?;
        }
        SSHAuthMethod::Key => {
            let key_path = connection
                .private_key_path
                .as_deref()
                .filter(|path| !path.trim().is_empty())
                .ok_or_else(|| "Private key path is required".to_string())?;
            session
                .userauth_pubkey_file(&connection.username, None, Path::new(key_path), password)
                .map_err(|err| format!("Private key authentication failed: {}", err))?;
        }
        SSHAuthMethod::Agent => {
            let mut agent = session
                .agent()
                .map_err(|err| format!("Failed to open SSH agent: {}", err))?;
            agent
                .connect()
                .map_err(|err| format!("Failed to connect to SSH agent: {}", err))?;
            agent
                .list_identities()
                .map_err(|err| format!("Failed to list SSH agent identities: {}", err))?;
            let identities = agent
                .identities()
                .map_err(|err| format!("Failed to read SSH agent identities: {}", err))?;
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
