use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use std::thread;
use tauri::{AppHandle, Emitter, Manager};

/// Terminal session entry
struct PtySession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    cols: u16,
    rows: u16,
}

/// Global PTY manager state
pub struct PtyManager {
    sessions: Mutex<HashMap<String, PtySession>>,
    counter: Mutex<u32>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            counter: Mutex::new(0),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
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
        cmd.env("PROMPT_COMMAND", r#"printf "\e]7;file://%s%s\a" "$HOSTNAME" "$PWD""#);
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
            PtySession {
                writer,
                master: pair.master,
                cols: 80,
                rows: 24,
            },
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

/// Write data to a terminal
#[tauri::command]
pub fn terminal_write(app: AppHandle, id: String, data: String) -> Result<(), String> {
    let state = app.state::<PtyManager>();
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get_mut(&id) {
        session
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("Write error: {}", e))?;
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
        // Skip if dimensions haven't changed
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
    Ok(())
}

/// Close/kill a terminal
#[tauri::command]
pub fn terminal_close(app: AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<PtyManager>();
    let mut sessions = state.sessions.lock().unwrap();
    sessions.remove(&id);
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


