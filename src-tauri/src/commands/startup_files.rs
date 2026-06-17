use std::{path::Path, sync::Mutex};

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
        let paths = filter_existing_startup_file_paths(urls
            .iter()
            .filter_map(|u| u.to_file_path().ok())
            .filter_map(|p| p.to_str().map(|s| s.to_string())));
        if !paths.is_empty() {
            let state: State<PendingFiles> = app.state();
            state.0.lock().unwrap().extend(paths.clone());
            let _ = app.emit("file-opened", &paths);
        }
    }
}

fn is_supported_startup_document_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| matches!(extension.to_ascii_lowercase().as_str(), "md" | "markdown"))
        .unwrap_or(false)
}

fn filter_existing_startup_file_paths<I, S>(paths: I) -> Vec<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    paths
        .into_iter()
        .filter_map(|path| {
            let path_text = path.as_ref();
            let candidate = Path::new(path_text);
            if is_supported_startup_document_path(candidate) && candidate.exists() {
                Some(path_text.to_string())
            } else {
                None
            }
        })
        .collect()
}

#[cfg(not(target_os = "macos"))]
fn extract_file_paths_from_args() -> Vec<String> {
    filter_existing_startup_file_paths(std::env::args().skip(1))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        time::{SystemTime, UNIX_EPOCH},
    };

    fn unique_temp_dir() -> std::path::PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("prism-startup-files-{stamp}"))
    }

    fn write_fixture(root: &Path, name: &str) -> String {
        let path = root.join(name);
        fs::write(&path, "# Fixture\n").unwrap();
        path.to_string_lossy().to_string()
    }

    #[test]
    fn filters_existing_markdown_startup_paths_and_preserves_order() {
        let root = unique_temp_dir();
        fs::create_dir_all(&root).unwrap();
        let md = write_fixture(&root, "first.md");
        let txt = write_fixture(&root, "notes.txt");
        let markdown = write_fixture(&root, "中文 文档.markdown");
        let missing = root.join("missing.md").to_string_lossy().to_string();

        let filtered = filter_existing_startup_file_paths([
            md.clone(),
            txt,
            missing,
            markdown.clone(),
        ]);

        assert_eq!(filtered, vec![md, markdown]);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn accepts_startup_markdown_extensions_case_insensitively() {
        let root = unique_temp_dir();
        fs::create_dir_all(&root).unwrap();
        let upper_md = write_fixture(&root, "UPPER.MD");
        let upper_markdown = write_fixture(&root, "UPPER.MARKDOWN");

        let filtered = filter_existing_startup_file_paths([
            upper_md.clone(),
            upper_markdown.clone(),
        ]);

        assert_eq!(filtered, vec![upper_md, upper_markdown]);
        fs::remove_dir_all(root).unwrap();
    }
}
