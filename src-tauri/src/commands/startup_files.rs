use std::sync::Mutex;

use tauri::{Emitter, Manager, State};

#[derive(Default)]
pub struct PendingFiles(Mutex<Vec<String>>);

#[tauri::command]
pub fn get_pending_files(state: State<PendingFiles>) -> Vec<String> {
    let mut files = state.0.lock().unwrap();
    let result = files.clone();
    files.clear();
    result
}

pub fn register_startup_files(app: &mut tauri::App) {
    #[cfg(not(target_os = "macos"))]
    {
        let paths = extract_file_paths_from_args();
        if !paths.is_empty() {
            let state: State<PendingFiles> = app.state();
            state.0.lock().unwrap().extend(paths.clone());
            let _ = app.emit("file-opened", &paths);
        }
    }

    #[cfg(target_os = "macos")]
    let _ = app;
}

pub fn handle_opened_event(app: &tauri::AppHandle, event: &tauri::RunEvent) {
    #[cfg(not(target_os = "macos"))]
    let _ = (app, event);

    #[cfg(target_os = "macos")]
    if let tauri::RunEvent::Opened { urls } = event {
        let paths: Vec<String> = urls
            .iter()
            .filter_map(|u| u.to_file_path().ok())
            .filter_map(|p| p.to_str().map(|s| s.to_string()))
            .collect();
        if !paths.is_empty() {
            let state: State<PendingFiles> = app.state();
            state.0.lock().unwrap().extend(paths.clone());
            let _ = app.emit("file-opened", &paths);
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn extract_file_paths_from_args() -> Vec<String> {
    std::env::args()
        .skip(1)
        .filter(|arg| {
            let lower = arg.to_lowercase();
            lower.ends_with(".md") || lower.ends_with(".markdown")
        })
        .filter(|path| std::path::Path::new(path).exists())
        .collect()
}
