mod modules;

use modules::notification::NotificationState;
use modules::pty::PtyManager;
use modules::discord::DiscordPresenceState;
use tauri::Manager;

#[tauri::command]
fn app_get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build())
        .setup(|app| {
            // Initialize PTY manager state
            app.manage(PtyManager::new());
            app.manage(NotificationState::new());
            app.manage(DiscordPresenceState::new());

            // Start notification TCP server
            modules::notification::start_notification_server(&app.handle());

            // Set window icon from embedded high-res PNG for crisp taskbar display
            if let Some(window) = app.get_webview_window("main") {
                let icon_bytes = include_bytes!("../icons/128x128@2x.png");
                if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
                    let _ = window.set_icon(icon);
                }
                let _ = window.show();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // App
            app_get_version,
            // Terminal
            modules::pty::terminal_create,
            modules::pty::terminal_write,
            modules::pty::terminal_resize,
            modules::pty::terminal_close,
            // Projects
            modules::projects::projects_list,
            modules::projects::projects_add,
            modules::projects::projects_update,
            modules::projects::projects_reorder,
            modules::projects::projects_delete,
            // Settings
            modules::settings::settings_get,
            modules::settings::settings_set,
            modules::settings::settings_get_shells,
            modules::settings::settings_get_default_shell,
            // Workspace
            modules::workspace::workspace_get_state,
            modules::workspace::workspace_save_state,
            // Git
            modules::git::git_status,
            modules::git::git_changed_files,
            modules::git::git_diff,
            modules::git::git_diff_untracked,
            modules::git::git_stage,
            modules::git::git_stage_all,
            modules::git::git_unstage,
            modules::git::git_unstage_all,
            modules::git::git_discard,
            modules::git::git_open_file,
            modules::git::git_commit,
            modules::git::git_push,
            modules::git::git_pull,
            modules::git::git_fetch,
            modules::git::git_history,
            modules::git::git_branches,
            modules::git::git_checkout,
            modules::git::git_create_branch,
            modules::git::git_publish_branch,
            modules::git::git_stash_list,
            modules::git::git_stash_save,
            modules::git::git_stash_pop,
            modules::git::git_stash_apply,
            modules::git::git_stash_drop,
            // Tasks
            modules::tasks::tasks_detect,
            // Theme
            modules::theme::theme_get,
            modules::theme::theme_set,
            modules::theme::theme_list,
            // Session
            modules::session::session_save,
            modules::session::session_load,
            modules::session::session_list,
            modules::session::session_delete,
            // Pinned
            modules::pinned::pinned_list,
            modules::pinned::pinned_save,
            // SSH
            modules::ssh::ssh_list,
            modules::ssh::ssh_save,
            modules::ssh::ssh_list_global,
            modules::ssh::ssh_save_global,
            modules::ssh::ssh_build_command,
            modules::ssh::ssh_key_exists,
            // Updater
            modules::updater::updater_check,
            modules::updater::updater_download,
            modules::updater::updater_install,
            // Notification
            modules::notification::notification_list,
            modules::notification::notification_unread_count,
            modules::notification::notification_mark_read,
            modules::notification::notification_mark_all_read,
            modules::notification::notification_remove,
            modules::notification::notification_clear,
            modules::notification::notification_get_settings,
            modules::notification::notification_update_settings,
            modules::notification::notification_get_port,
            modules::notification::notification_get_providers,
            modules::notification::notification_install_hook,
            modules::notification::notification_uninstall_hook,
            modules::notification::notification_upload_sound,
            modules::notification::notification_remove_custom_sound,
            modules::notification::notification_get_sound_path,
            // Explorer
            modules::explorer::explorer_list_dir,
            modules::explorer::explorer_read_tree,
            modules::explorer::explorer_read_file,
            modules::explorer::explorer_write_file,
            modules::explorer::explorer_rename,
            modules::explorer::explorer_delete,
            modules::explorer::explorer_new_file,
            modules::explorer::explorer_new_folder,
            modules::explorer::explorer_open_path,
            modules::explorer::explorer_search_in_files,
            // Clipboard
            modules::clipboard::clipboard_has_image,
            modules::clipboard::clipboard_read_text,
            // Discord Presence
            modules::discord::discord_presence_connect,
            modules::discord::discord_presence_disconnect,
            modules::discord::discord_presence_update,
            modules::discord::discord_presence_is_connected,
        ])
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    // Give frontend a moment to flush workspace state
                    // The frontend listens for beforeunload which fires when we close
                    let app = window.app_handle().clone();
                    let window_clone = window.clone();
                    api.prevent_close();
                    // Small delay to let IPC flush complete, then actually close
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(100));
                        modules::pty::kill_all(&app);
                        let _ = window_clone.destroy();
                    });
                }
                tauri::WindowEvent::Destroyed => {
                    let app = window.app_handle();
                    modules::pty::kill_all(app);
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Connexio");
}
