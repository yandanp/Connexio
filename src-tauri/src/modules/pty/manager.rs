use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use ssh2::Channel;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, Manager};

/// Terminal session entry
pub(crate) struct PtySession {
    pub(crate) writer: Box<dyn Write + Send>,
    pub(crate) master: Box<dyn MasterPty + Send>,
    pub(crate) cols: u16,
    pub(crate) rows: u16,
    pub(crate) context: Option<TerminalContext>,
}

pub(crate) enum TerminalSession {
    Local(PtySession),
    Ssh(SshTerminalSession),
}

pub(crate) struct SshTerminalSession {
    pub(crate) channel: Arc<Mutex<Channel>>,
    pub(crate) cols: u16,
    pub(crate) rows: u16,
    pub(crate) context: Option<TerminalContext>,
}

/// Global PTY manager state
pub struct PtyManager {
    pub(crate) sessions: Mutex<HashMap<String, TerminalSession>>,
    counter: Mutex<u32>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            counter: Mutex::new(0),
        }
    }

    pub(crate) fn find_by_context(&self, project_id: &str, tab_id: &str) -> Option<String> {
        let sessions = self.sessions.lock().unwrap();
        sessions.iter().find_map(|(id, session)| {
            let context = match session {
                TerminalSession::Local(s) => s.context.as_ref(),
                TerminalSession::Ssh(s) => s.context.as_ref(),
            }?;
            if context.project_id == project_id && context.tab_id == tab_id {
                Some(id.clone())
            } else {
                None
            }
        })
    }

    pub(crate) fn session_ids(&self) -> Vec<String> {
        self.sessions.lock().unwrap().keys().cloned().collect()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalContext {
    pub project_id: String,
    pub project_name: String,
    pub tab_id: String,
    pub tab_label: String,
}

/// Create a new terminal session
#[tauri::command]
pub fn terminal_create(
    app: AppHandle,
    project_path: String,
    shell: Option<String>,
    context: Option<TerminalContext>,
) -> Result<String, String> {
    log::info!("terminal_create: path={}, shell={:?}", project_path, shell);
    let state = app.state::<PtyManager>();

    let id = {
        let mut counter = state.counter.lock().unwrap();
        *counter += 1;
        format!("term-{}", *counter)
    };

    let pty_system = native_pty_system();

    let size = PtySize {
        rows: 24,
        cols: 80,
        pixel_width: 0,
        pixel_height: 0,
    };

    let pair = pty_system
        .openpty(size)
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    // Determine shell
    let shell_path = shell.unwrap_or_else(|| default_shell());

    // Build command — detect PowerShell for shell integration
    let shell_lower = shell_path.replace('\\', "/").to_lowercase();
    let is_powershell = shell_lower.contains("pwsh") || shell_lower.contains("powershell");

    let mut cmd = CommandBuilder::new(&shell_path);

    // For PowerShell: set UTF-8 encoding via -Command but let profile load normally
    #[cfg(target_os = "windows")]
    if is_powershell {
        cmd.arg("-NoLogo");
        cmd.arg("-NoExit");
        cmd.arg("-Command");
        cmd.arg("[Console]::InputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $global:OutputEncoding = [System.Text.UTF8Encoding]::new($false)");
    }

    // Set working directory
    let cwd = if std::path::Path::new(&project_path).is_dir() {
        project_path.clone()
    } else {
        dirs::home_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| ".".to_string())
    };
    cmd.cwd(&cwd);

    // Inherit all environment variables from parent process first
    for (key, value) in std::env::vars() {
        cmd.env(key, value);
    }

    // Then override/add specific ones
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("TERM_PROGRAM", "Connexio");
    cmd.env("CONNEXIO_TERMINAL", "1");

    // Inject notification server port for AI agent hooks
    if let Some(notif_state) = app.try_state::<crate::modules::notification::NotificationState>() {
        if let Some(port) = *notif_state.server_port.lock().unwrap() {
            cmd.env("CONNEXIO_NOTIFICATION_PORT", format!("{}", port));
        }
    }

    // Shell integration: set env vars for CWD reporting (OSC 7)
    // These are picked up by shell profile/init without visible injection
    if shell_lower.contains("bash") {
        // Bash: PROMPT_COMMAND emits OSC 7
        cmd.env(
            "PROMPT_COMMAND",
            r#"printf "\e]7;file://%s%s\a" "$HOSTNAME" "$PWD""#,
        );
    }
    if let Some(ref ctx) = context {
        cmd.env("CONNEXIO_PROJECT_ID", &ctx.project_id);
        cmd.env("CONNEXIO_PROJECT_NAME", &ctx.project_name);
        cmd.env("CONNEXIO_TAB_ID", &ctx.tab_id);
        cmd.env("CONNEXIO_TAB_LABEL", &ctx.tab_label);
        cmd.env("CONNEXIO_TERMINAL_ID", &id);
    }

    // Spawn child
    let _child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    // Drop slave — we only need the master side
    drop(pair.slave);

    // Get writer for input
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to get PTY writer: {}", e))?;

    // Get reader for output
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to get PTY reader: {}", e))?;

    // Store session
    {
        let mut sessions = state.sessions.lock().unwrap();
        sessions.insert(
            id.clone(),
            TerminalSession::Local(PtySession {
                writer,
                master: pair.master,
                cols: 80,
                rows: 24,
                context: context.clone(),
            }),
        );
    }

    // Spawn reader thread to stream output to frontend
    let term_id = id.clone();
    let app_handle = app.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break, // EOF
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_handle.emit("terminal:data", (&term_id, &data));
                }
                Err(_) => break,
            }
        }
        // Terminal exited — notify frontend
        let _ = app_handle.emit("terminal:exit", &term_id);
    });

    Ok(id)
}

/// Create a terminal session that runs a specific program directly.
#[tauri::command]
pub fn terminal_create_command(
    app: AppHandle,
    project_path: String,
    command: Vec<String>,
    context: Option<TerminalContext>,
) -> Result<String, String> {
    if command.is_empty() {
        return Err("Command cannot be empty".to_string());
    }

    let state = app.state::<PtyManager>();
    let id = {
        let mut counter = state.counter.lock().unwrap();
        *counter += 1;
        format!("term-{}", *counter)
    };

    let pty_system = native_pty_system();
    let size = PtySize {
        rows: 24,
        cols: 80,
        pixel_width: 0,
        pixel_height: 0,
    };
    let pair = pty_system
        .openpty(size)
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    let mut cmd = CommandBuilder::new(&command[0]);
    for arg in command.iter().skip(1) {
        cmd.arg(arg);
    }

    let cwd = if std::path::Path::new(&project_path).is_dir() {
        project_path.clone()
    } else {
        dirs::home_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| ".".to_string())
    };
    cmd.cwd(&cwd);

    for (key, value) in std::env::vars() {
        cmd.env(key, value);
    }
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("TERM_PROGRAM", "Connexio");
    cmd.env("CONNEXIO_TERMINAL", "1");
    if let Some(ref ctx) = context {
        cmd.env("CONNEXIO_PROJECT_ID", &ctx.project_id);
        cmd.env("CONNEXIO_PROJECT_NAME", &ctx.project_name);
        cmd.env("CONNEXIO_TAB_ID", &ctx.tab_id);
        cmd.env("CONNEXIO_TAB_LABEL", &ctx.tab_label);
        cmd.env("CONNEXIO_TERMINAL_ID", &id);
    }

    let _child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn command: {}", e))?;
    drop(pair.slave);

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to get PTY writer: {}", e))?;
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to get PTY reader: {}", e))?;

    {
        let mut sessions = state.sessions.lock().unwrap();
        sessions.insert(
            id.clone(),
            TerminalSession::Local(PtySession {
                writer,
                master: pair.master,
                cols: 80,
                rows: 24,
                context: context.clone(),
            }),
        );
    }

    let term_id = id.clone();
    let app_handle = app.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_handle.emit("terminal:data", (&term_id, &data));
                }
                Err(_) => break,
            }
        }
        let _ = app_handle.emit("terminal:exit", &term_id);
    });

    Ok(id)
}

/// Create a native SSH terminal session using the integrated SSH backend.
#[tauri::command]
pub fn terminal_create_ssh(
    app: AppHandle,
    connection: crate::modules::ssh::SSHConnection,
    password: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<String, String> {
    let state = app.state::<PtyManager>();
    let id = {
        let mut counter = state.counter.lock().unwrap();
        *counter += 1;
        format!("term-{}", *counter)
    };

    let cols = cols.unwrap_or(80).max(1);
    let rows = rows.unwrap_or(24).max(1);
    let session = crate::modules::ssh::ssh_connect_session(&connection, password.as_deref())?;
    let _ = app.emit("terminal:ssh-status", (&id, "authenticated"));
    let mut channel = session
        .channel_session()
        .map_err(|e| format!("Failed to open SSH channel: {}", e))?;
    channel
        .request_pty(
            "xterm-256color",
            None,
            Some((cols as u32, rows as u32, 0, 0)),
        )
        .map_err(|e| format!("Failed to request SSH PTY: {}", e))?;
    channel
        .shell()
        .map_err(|e| format!("Failed to start SSH shell: {}", e))?;
    let _ = app.emit("terminal:ssh-status", (&id, "shell-started"));
    session.set_blocking(false);

    let channel = Arc::new(Mutex::new(channel));
    {
        let mut sessions = state.sessions.lock().unwrap();
        sessions.insert(
            id.clone(),
            TerminalSession::Ssh(SshTerminalSession {
                channel: channel.clone(),
                cols,
                rows,
                context: None,
            }),
        );
    }

    let term_id = id.clone();
    let app_handle = app.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            let read_result = {
                let mut locked = match channel.lock() {
                    Ok(locked) => locked,
                    Err(_) => break,
                };
                locked.read(&mut buf)
            };
            match read_result {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_handle.emit("terminal:data", (&term_id, &data));
                }
                Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(std::time::Duration::from_millis(16));
                }
                Err(_) => break,
            }
        }
        let _ = app_handle.emit("terminal:exit", &term_id);
    });

    Ok(id)
}

/// Write data to a terminal
#[tauri::command]
pub fn terminal_write(app: AppHandle, id: String, data: String) -> Result<(), String> {
    let state = app.state::<PtyManager>();
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get_mut(&id) {
        match session {
            TerminalSession::Local(session) => session
                .writer
                .write_all(data.as_bytes())
                .map_err(|e| format!("Write error: {}", e))?,
            TerminalSession::Ssh(session) => {
                let mut channel = session
                    .channel
                    .lock()
                    .map_err(|_| "SSH channel lock poisoned".to_string())?;
                channel
                    .write_all(data.as_bytes())
                    .map_err(|e| format!("SSH write error: {}", e))?;
                channel
                    .flush()
                    .map_err(|e| format!("SSH flush error: {}", e))?;
            }
        }
    }
    Ok(())
}

/// Resize a terminal
#[tauri::command]
pub fn terminal_resize(app: AppHandle, id: String, cols: u16, rows: u16) -> Result<(), String> {
    if cols == 0 || rows == 0 {
        return Ok(());
    }

    let state = app.state::<PtyManager>();
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get_mut(&id) {
        match session {
            TerminalSession::Local(session) => {
                if session.cols == cols && session.rows == rows {
                    return Ok(());
                }
                session
                    .master
                    .resize(PtySize {
                        rows,
                        cols,
                        pixel_width: 0,
                        pixel_height: 0,
                    })
                    .map_err(|e| format!("Resize error: {}", e))?;
                session.cols = cols;
                session.rows = rows;
            }
            TerminalSession::Ssh(session) => {
                if session.cols == cols && session.rows == rows {
                    return Ok(());
                }
                let mut channel = session
                    .channel
                    .lock()
                    .map_err(|_| "SSH channel lock poisoned".to_string())?;
                channel
                    .request_pty_size(cols as u32, rows as u32, None, None)
                    .map_err(|e| format!("SSH resize error: {}", e))?;
                session.cols = cols;
                session.rows = rows;
            }
        }
    }
    Ok(())
}

/// Close/kill a terminal
#[tauri::command]
pub fn terminal_close(app: AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<PtyManager>();
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.remove(&id) {
        if let TerminalSession::Ssh(session) = session {
            if let Ok(mut channel) = session.channel.try_lock() {
                let _ = channel.close();
            }
        }
    }
    Ok(())
}

/// Kill all terminals (called on app exit)
pub fn kill_all(app: &AppHandle) {
    let state = app.state::<PtyManager>();
    let mut sessions = state.sessions.lock().unwrap();
    sessions.clear();
}

/// Get default shell for the current platform
fn default_shell() -> String {
    #[cfg(target_os = "windows")]
    {
        // Prefer PowerShell 7
        let pwsh7 = "C:\\Program Files\\PowerShell\\7\\pwsh.exe";
        if std::path::Path::new(pwsh7).exists() {
            return pwsh7.to_string();
        }
        "powershell.exe".to_string()
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
    }
}
