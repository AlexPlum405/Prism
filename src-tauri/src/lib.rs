use std::path::PathBuf;
use tauri::{AppHandle, Manager};

mod commands;

pub(crate) fn first_non_empty_line(text: &[u8]) -> String {
    String::from_utf8_lossy(text)
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("")
        .chars()
        .take(240)
        .collect()
}

pub(crate) fn canonicalize_existing_path(path: &str) -> Result<PathBuf, String> {
    PathBuf::from(path)
        .canonicalize()
        .map_err(|err| format!("Failed to access path: {err}"))
}

#[tauri::command]
fn read_legacy_settings_config(app: AppHandle) -> Result<Option<String>, String> {
    let app_data = app.path().app_data_dir().map_err(|err| err.to_string())?;
    let config_path = app_data.join("config.json");
    if config_path.exists() {
        return Ok(None);
    }

    let legacy_path = PathBuf::from(format!("{}{}", app_data.to_string_lossy(), "config.json"));
    if legacy_path == config_path || !legacy_path.is_file() {
        return Ok(None);
    }

    std::fs::read_to_string(legacy_path)
        .map(Some)
        .map_err(|err| format!("Failed to read legacy settings file: {err}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pending_files = commands::startup_files::PendingFiles::default();

    tauri::Builder::default()
        .manage(pending_files)
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            commands::startup_files::register_startup_files(app);

            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::startup_files::get_pending_files,
            commands::pandoc::detect_pandoc,
            commands::pandoc::render_citations_with_pandoc,
            commands::file_scope::grant_markdown_file_scope,
            commands::file_scope::grant_workspace_directory_scope,
            commands::trash::move_path_to_trash,
            commands::system_open::open_path_with_system,
            commands::pdf_capture::capture_current_webview_pdf,
            read_legacy_settings_config
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            commands::startup_files::handle_opened_event(app, &event);
        });
}
