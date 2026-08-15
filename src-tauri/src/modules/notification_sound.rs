use serde_json::json;
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Manager};

use super::notification::{save_notif_settings, NotificationState};

/// Validates the uploaded audio file and returns its normalized (lowercase) extension.
fn validate_sound_file(path: &Path) -> Result<String, String> {
    if !path.is_file() {
        return Err(format!("File not found: {}", path.display()));
    }
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();
    if !matches!(ext.as_str(), "wav" | "mp3" | "ogg") {
        return Err("Unsupported audio format (use wav, mp3, or ogg)".to_string());
    }
    Ok(ext)
}

#[tauri::command]
pub fn notification_upload_sound(
    app: AppHandle,
    path: String,
) -> Result<serde_json::Value, String> {
    let src = Path::new(&path);
    let ext = match validate_sound_file(src) {
        Ok(ext) => ext,
        Err(error) => return Ok(json!({ "success": false, "error": error })),
    };

    // Copy into app data so the sound survives moving/deleting the original file.
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("sounds");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let dest = dir.join(format!("notification.{ext}"));
    fs::copy(src, &dest).map_err(|e| e.to_string())?;

    let state = app.state::<NotificationState>();
    let mut settings = state.settings.lock().unwrap();
    let dest_str = dest.to_string_lossy().to_string();
    if let Some(ref old) = settings.custom_sound_path {
        if *old != dest_str {
            let old_path = Path::new(old);
            if old_path.is_file() {
                let _ = fs::remove_file(old_path);
            }
        }
    }
    settings.custom_sound_path = Some(dest_str.clone());
    save_notif_settings(&app, &settings);
    Ok(json!({ "success": true, "path": dest_str }))
}

#[tauri::command]
pub fn notification_remove_custom_sound(app: AppHandle) -> Result<(), String> {
    let state = app.state::<NotificationState>();
    let mut settings = state.settings.lock().unwrap();
    if let Some(ref path) = settings.custom_sound_path {
        if std::path::Path::new(path).exists() {
            let _ = fs::remove_file(path);
        }
    }
    settings.custom_sound_path = None;
    save_notif_settings(&app, &settings);
    Ok(())
}

#[tauri::command]
pub fn notification_get_sound_path(app: AppHandle) -> Option<String> {
    let state = app.state::<NotificationState>();
    let path = state.settings.lock().unwrap().custom_sound_path.clone();
    path
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;

    fn temp_file(name: &str) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!("connexio-sound-test-{name}"));
        File::create(&path).expect("create temp file");
        path
    }

    #[test]
    fn validate_rejects_missing_file() {
        let result = validate_sound_file(Path::new("/definitely/not/here.wav"));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("File not found"));
    }

    #[test]
    fn validate_rejects_unsupported_extension() {
        let path = temp_file("bad.txt");
        let result = validate_sound_file(&path);
        let _ = fs::remove_file(&path);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unsupported audio format"));
    }

    #[test]
    fn validate_accepts_supported_extensions_case_insensitive() {
        for (name, expected) in [("ok.WAV", "wav"), ("ok.Mp3", "mp3"), ("ok.ogg", "ogg")] {
            let path = temp_file(name);
            let result = validate_sound_file(&path);
            let _ = fs::remove_file(&path);
            assert_eq!(result.expect("should accept"), expected);
        }
    }
}
