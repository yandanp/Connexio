use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn data_dir(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn settings_file(app: &AppHandle) -> PathBuf {
    data_dir(app).join("settings.json")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub default_shell: String,
    pub font_size: u32,
    pub font_family: String,
    pub cursor_style: String,
    pub cursor_blink: bool,
    pub scrollback: u32,
    pub copy_on_select: bool,
    pub webgl_renderer: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_shell: String::new(),
            font_size: 13,
            font_family: "'JetBrainsMono NF', 'JetBrainsMono Nerd Font', 'CaskaydiaCove Nerd Font', 'FiraCode Nerd Font', 'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace".to_string(),
            cursor_style: "bar".to_string(),
            cursor_blink: false,
            scrollback: 1000,
            copy_on_select: false,
            webgl_renderer: true,
        }
    }
}

fn load_settings(app: &AppHandle) -> AppSettings {
    let path = settings_file(app);
    if !path.exists() {
        return AppSettings::default();
    }
    let content = fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&content).unwrap_or_default()
}

fn save_settings_to_file(app: &AppHandle, settings: &AppSettings) {
    let path = settings_file(app);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(settings).unwrap_or_default();
    let _ = fs::write(&path, json);
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShellInfo {
    pub id: String,
    pub name: String,
    pub path: String,
}

#[tauri::command]
pub fn settings_get(app: AppHandle) -> AppSettings {
    load_settings(&app)
}

#[tauri::command]
pub fn settings_set(app: AppHandle, settings: AppSettings) -> AppSettings {
    save_settings_to_file(&app, &settings);
    settings
}

#[tauri::command]
pub fn settings_get_shells() -> Vec<ShellInfo> {
    detect_shells()
}

#[tauri::command]
pub fn settings_get_default_shell(app: AppHandle) -> String {
    let settings = load_settings(&app);
    if !settings.default_shell.is_empty() {
        return settings.default_shell;
    }
    super::shell::default_shell()
}

fn detect_shells() -> Vec<ShellInfo> {
    let mut shells = Vec::new();

    #[cfg(target_os = "windows")]
    {
        use std::path::Path;

        // PowerShell 7
        let pwsh7_paths = [
            "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
            "C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe",
        ];
        for p in &pwsh7_paths {
            if Path::new(p).exists() {
                shells.push(ShellInfo {
                    id: "pwsh7".to_string(),
                    name: "PowerShell 7".to_string(),
                    path: p.to_string(),
                });
                break;
            }
        }

        // Windows PowerShell
        let system_root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());
        let wpsh = format!("{}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", system_root);
        if Path::new(&wpsh).exists() {
            shells.push(ShellInfo {
                id: "powershell".to_string(),
                name: "Windows PowerShell".to_string(),
                path: wpsh,
            });
        }

        // CMD
        let cmd = format!("{}\\System32\\cmd.exe", system_root);
        if Path::new(&cmd).exists() {
            shells.push(ShellInfo {
                id: "cmd".to_string(),
                name: "Command Prompt".to_string(),
                path: cmd,
            });
        }

        // Git Bash
        let git_bash_paths = [
            "C:\\Program Files\\Git\\bin\\bash.exe",
            "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
        ];
        for p in &git_bash_paths {
            if Path::new(p).exists() {
                shells.push(ShellInfo {
                    id: "gitbash".to_string(),
                    name: "Git Bash".to_string(),
                    path: p.to_string(),
                });
                break;
            }
        }

        // WSL
        let wsl = format!("{}\\System32\\wsl.exe", system_root);
        if Path::new(&wsl).exists() {
            shells.push(ShellInfo {
                id: "wsl".to_string(),
                name: "WSL".to_string(),
                path: wsl,
            });
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::path::Path;

        let unix_shells = [
            ("bash", "Bash", &["/bin/bash", "/usr/bin/bash"][..]),
            ("zsh", "Zsh", &["/bin/zsh", "/usr/bin/zsh"][..]),
            ("fish", "Fish", &["/usr/bin/fish", "/usr/local/bin/fish", "/opt/homebrew/bin/fish"][..]),
        ];

        for (id, name, paths) in &unix_shells {
            for p in *paths {
                if Path::new(p).exists() {
                    shells.push(ShellInfo {
                        id: id.to_string(),
                        name: name.to_string(),
                        path: p.to_string(),
                    });
                    break;
                }
            }
        }
    }

    shells
}
