use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn data_dir(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn theme_file(app: &AppHandle) -> PathBuf {
    data_dir(app).join("theme.json")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeColors {
    pub bg_primary: String,
    pub bg_secondary: String,
    pub bg_tertiary: String,
    pub border_color: String,
    pub accent_color: String,
    pub accent_hover: String,
    pub text_primary: String,
    pub text_secondary: String,
    pub text_muted: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalThemeColors {
    pub background: String,
    pub foreground: String,
    pub cursor: String,
    pub cursor_accent: String,
    pub selection_background: String,
    pub black: String,
    pub red: String,
    pub green: String,
    pub yellow: String,
    pub blue: String,
    pub magenta: String,
    pub cyan: String,
    pub white: String,
    pub bright_black: String,
    pub bright_red: String,
    pub bright_green: String,
    pub bright_yellow: String,
    pub bright_blue: String,
    pub bright_magenta: String,
    pub bright_cyan: String,
    pub bright_white: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppTheme {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub theme_type: String,
    pub colors: ThemeColors,
    pub terminal: TerminalThemeColors,
}

fn default_themes() -> Vec<AppTheme> {
    vec![
        AppTheme {
            id: "connexio-dark".to_string(),
            name: "Connexio Dark".to_string(),
            theme_type: "dark".to_string(),
            colors: ThemeColors {
                bg_primary: "#0f1117".to_string(),
                bg_secondary: "#161822".to_string(),
                bg_tertiary: "#1e2030".to_string(),
                border_color: "#2a2d3e".to_string(),
                accent_color: "#7c3aed".to_string(),
                accent_hover: "#6d28d9".to_string(),
                text_primary: "#e2e8f0".to_string(),
                text_secondary: "#94a3b8".to_string(),
                text_muted: "#64748b".to_string(),
            },
            terminal: TerminalThemeColors {
                background: "#0f1117".to_string(),
                foreground: "#e2e8f0".to_string(),
                cursor: "#7c3aed".to_string(),
                cursor_accent: "#0f1117".to_string(),
                selection_background: "#7c3aed40".to_string(),
                black: "#1e2030".to_string(),
                red: "#f87171".to_string(),
                green: "#4ade80".to_string(),
                yellow: "#fbbf24".to_string(),
                blue: "#60a5fa".to_string(),
                magenta: "#c084fc".to_string(),
                cyan: "#22d3ee".to_string(),
                white: "#e2e8f0".to_string(),
                bright_black: "#64748b".to_string(),
                bright_red: "#fca5a5".to_string(),
                bright_green: "#86efac".to_string(),
                bright_yellow: "#fde68a".to_string(),
                bright_blue: "#93c5fd".to_string(),
                bright_magenta: "#d8b4fe".to_string(),
                bright_cyan: "#67e8f9".to_string(),
                bright_white: "#f8fafc".to_string(),
            },
        },
        AppTheme {
            id: "connexio-light".to_string(),
            name: "Connexio Light".to_string(),
            theme_type: "light".to_string(),
            colors: ThemeColors {
                bg_primary: "#ffffff".to_string(),
                bg_secondary: "#f8fafc".to_string(),
                bg_tertiary: "#f1f5f9".to_string(),
                border_color: "#e2e8f0".to_string(),
                accent_color: "#7c3aed".to_string(),
                accent_hover: "#6d28d9".to_string(),
                text_primary: "#1e293b".to_string(),
                text_secondary: "#475569".to_string(),
                text_muted: "#94a3b8".to_string(),
            },
            terminal: TerminalThemeColors {
                background: "#ffffff".to_string(),
                foreground: "#1e293b".to_string(),
                cursor: "#7c3aed".to_string(),
                cursor_accent: "#ffffff".to_string(),
                selection_background: "#7c3aed30".to_string(),
                black: "#1e293b".to_string(),
                red: "#dc2626".to_string(),
                green: "#16a34a".to_string(),
                yellow: "#ca8a04".to_string(),
                blue: "#2563eb".to_string(),
                magenta: "#9333ea".to_string(),
                cyan: "#0891b2".to_string(),
                white: "#f8fafc".to_string(),
                bright_black: "#64748b".to_string(),
                bright_red: "#ef4444".to_string(),
                bright_green: "#22c55e".to_string(),
                bright_yellow: "#eab308".to_string(),
                bright_blue: "#3b82f6".to_string(),
                bright_magenta: "#a855f7".to_string(),
                bright_cyan: "#06b6d4".to_string(),
                bright_white: "#ffffff".to_string(),
            },
        },
        AppTheme {
            id: "midnight-ocean".to_string(),
            name: "Midnight Ocean".to_string(),
            theme_type: "dark".to_string(),
            colors: ThemeColors {
                bg_primary: "#0a192f".to_string(),
                bg_secondary: "#112240".to_string(),
                bg_tertiary: "#1d3461".to_string(),
                border_color: "#233554".to_string(),
                accent_color: "#64ffda".to_string(),
                accent_hover: "#4fd1c5".to_string(),
                text_primary: "#ccd6f6".to_string(),
                text_secondary: "#8892b0".to_string(),
                text_muted: "#495670".to_string(),
            },
            terminal: TerminalThemeColors {
                background: "#0a192f".to_string(),
                foreground: "#ccd6f6".to_string(),
                cursor: "#64ffda".to_string(),
                cursor_accent: "#0a192f".to_string(),
                selection_background: "#64ffda30".to_string(),
                black: "#112240".to_string(),
                red: "#ff6b6b".to_string(),
                green: "#64ffda".to_string(),
                yellow: "#ffd93d".to_string(),
                blue: "#57c7ff".to_string(),
                magenta: "#c792ea".to_string(),
                cyan: "#89ddff".to_string(),
                white: "#ccd6f6".to_string(),
                bright_black: "#495670".to_string(),
                bright_red: "#ff8a8a".to_string(),
                bright_green: "#9effec".to_string(),
                bright_yellow: "#ffe566".to_string(),
                bright_blue: "#82d7ff".to_string(),
                bright_magenta: "#dbb4f3".to_string(),
                bright_cyan: "#a6e7ff".to_string(),
                bright_white: "#e6f1ff".to_string(),
            },
        },
    ]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ThemeState {
    active_theme_id: String,
}

#[tauri::command]
pub fn theme_get(app: AppHandle) -> AppTheme {
    let path = theme_file(&app);
    let active_id = if path.exists() {
        fs::read_to_string(&path)
            .ok()
            .and_then(|c| serde_json::from_str::<ThemeState>(&c).ok())
            .map(|s| s.active_theme_id)
            .unwrap_or_else(|| "connexio-dark".to_string())
    } else {
        "connexio-dark".to_string()
    };

    let themes = default_themes();
    themes
        .into_iter()
        .find(|t| t.id == active_id)
        .unwrap_or_else(|| default_themes().remove(0))
}

#[tauri::command]
pub fn theme_set(app: AppHandle, theme_id: String) {
    let path = theme_file(&app);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let state = ThemeState {
        active_theme_id: theme_id,
    };
    let json = serde_json::to_string_pretty(&state).unwrap_or_default();
    let _ = fs::write(&path, json);
}

#[tauri::command]
pub fn theme_list() -> Vec<AppTheme> {
    default_themes()
}
