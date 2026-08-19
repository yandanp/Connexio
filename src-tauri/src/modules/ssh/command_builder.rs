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

#[cfg(test)]
mod tests {
    use super::*;

    fn connection(port: u16) -> SSHConnection {
        SSHConnection {
            id: "x".into(),
            name: "x".into(),
            host: "example.com".into(),
            port,
            username: "user".into(),
            auth_method: SSHAuthMethod::Password,
            private_key_path: None,
            color: None,
            folder: None,
            tags: vec![],
            notes: None,
            identity_id: None,
            password_secret_ref: None,
            passphrase_secret_ref: None,
            startup_commands: vec![],
            keep_alive_secs: None,
            tunnels: vec![],
        }
    }

    #[test]
    fn build_command_args_includes_port_and_target() {
        let args = ssh_build_command_args(connection(2222));
        assert!(args.iter().any(|a| a == "-p"));
        assert!(args.iter().any(|a| a == "2222"));
        assert!(args.iter().any(|a| a.contains("user@example.com")));
    }

    #[test]
    fn build_command_args_omits_port_flag_for_default_port() {
        let args = ssh_build_command_args(connection(22));
        assert_eq!(args.first().map(String::as_str), Some("ssh"));
        assert!(!args.iter().any(|a| a == "-p"));
        assert_eq!(args.last().map(String::as_str), Some("user@example.com"));
    }

    #[test]
    fn build_command_args_includes_key_and_keepalive() {
        let mut conn = connection(2222);
        conn.auth_method = SSHAuthMethod::Key;
        conn.private_key_path = Some("/keys/id_rsa".into());
        conn.keep_alive_secs = Some(30);
        let args = ssh_build_command_args(conn);
        // Characterization: the args builder passes the key path through unquoted
        // (unlike ssh_build_command) and emits one arg per flag value.
        assert_eq!(
            args,
            vec![
                "ssh",
                "-p",
                "2222",
                "-i",
                "/keys/id_rsa",
                "-o",
                "ServerAliveInterval=30",
                "user@example.com",
            ]
        );
    }

    #[test]
    fn shell_quote_passes_through_safe_chars() {
        assert_eq!(shell_quote("user@example.com"), "user@example.com");
        assert_eq!(shell_quote("C:\\keys\\id_rsa"), "C:\\keys\\id_rsa");
    }

    #[test]
    fn shell_quote_wraps_spaces() {
        // Characterization: quoting style is platform-specific — double quotes on
        // Windows, single quotes elsewhere.
        #[cfg(target_os = "windows")]
        assert_eq!(shell_quote("a b"), "\"a b\"");
        #[cfg(not(target_os = "windows"))]
        assert_eq!(shell_quote("a b"), "'a b'");
    }

    #[test]
    fn build_command_joins_startup_commands() {
        let mut conn = connection(22);
        conn.startup_commands = vec!["".into(), "   ".into(), "htop".into(), " vim ".into()];
        assert_eq!(
            ssh_build_command(conn),
            "ssh user@example.com && htop && vim"
        );
    }
}
