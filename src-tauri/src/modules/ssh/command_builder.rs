use super::types::{SSHAuthMethod, SSHConnection};

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
    for startup_command in connection
        .startup_commands
        .iter()
        .filter(|cmd| !cmd.trim().is_empty())
    {
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
