#[cfg(target_os = "macos")]
use std::path::PathBuf;
#[cfg(target_os = "macos")]
use std::time::{SystemTime, UNIX_EPOCH};
use std::{collections::HashSet, path::Path, sync::Mutex};

use tauri::{Emitter, Manager, State};

#[derive(Default)]
pub struct PendingFiles {
    files: Mutex<Vec<String>>,
    workspace_path: Mutex<Option<String>>,
}

impl PendingFiles {
    fn push_paths(&self, paths: Vec<String>) {
        let mut files = self.files.lock().unwrap();
        let mut seen: HashSet<String> = files.iter().cloned().collect();
        for path in paths {
            if seen.insert(path.clone()) {
                files.push(path);
            }
        }
    }

    fn is_empty(&self) -> bool {
        self.files.lock().unwrap().is_empty()
    }

    fn set_workspace_path(&self, path: String) {
        *self.workspace_path.lock().unwrap() = Some(path);
    }

    fn take_workspace_path(&self) -> Option<String> {
        self.workspace_path.lock().unwrap().take()
    }
}

#[tauri::command]
pub fn get_pending_files(state: State<PendingFiles>) -> Vec<String> {
    let mut files = state.files.lock().unwrap();
    let result = files.clone();
    files.clear();
    result
}

#[tauri::command]
pub fn get_pending_workspace_path(state: State<PendingFiles>) -> Option<String> {
    state.take_workspace_path()
}

pub fn has_pending_files(app: &tauri::App) -> bool {
    let state: State<PendingFiles> = app.state();
    !state.is_empty()
}

pub fn queue_pending_files(app: &mut tauri::App, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }

    let state: State<PendingFiles> = app.state();
    state.push_paths(paths.clone());
    let _ = app.emit("file-opened", &paths);
}

pub fn queue_pending_workspace_path(app: &mut tauri::App, path: String) {
    if path.is_empty() {
        return;
    }

    let state: State<PendingFiles> = app.state();
    state.set_workspace_path(path);
}

pub fn register_startup_files(app: &mut tauri::App) {
    let paths = extract_file_paths_from_args();
    if !paths.is_empty() {
        queue_pending_files(app, paths);
    }
}

pub fn handle_opened_event(app: &tauri::AppHandle, event: &tauri::RunEvent) {
    #[cfg(not(target_os = "macos"))]
    let _ = (app, event);

    #[cfg(target_os = "macos")]
    if let tauri::RunEvent::Opened { urls } = event {
        let paths = filter_supported_startup_file_paths(
            urls.iter()
                .filter_map(|u| u.to_file_path().ok())
                .filter_map(|p| p.to_str().map(|s| s.to_string())),
        );
        let paths_to_open: Vec<String> = paths
            .into_iter()
            .filter(|path| !focus_existing_startup_file_window(app, path))
            .collect();

        if paths_to_open.is_empty() {
            return;
        }

        if should_open_startup_files_in_new_windows(has_visible_startup_file_window(app)) {
            let failed_paths: Vec<String> = paths_to_open
                .iter()
                .enumerate()
                .filter_map(|(index, path)| {
                    open_startup_file_window(app, path, index)
                        .map(|_| None)
                        .unwrap_or_else(|error| {
                            eprintln!(
                                "[startup_files] Failed to open startup file window for {path}: {error}"
                            );
                            Some(path.clone())
                        })
                })
                .collect();

            if failed_paths.is_empty() {
                return;
            }

            queue_opened_paths_for_existing_window(app, failed_paths);
            return;
        }

        queue_opened_paths_for_existing_window(app, paths_to_open);
    }
}

#[cfg(target_os = "macos")]
fn is_prism_document_window(label: &str) -> bool {
    label == "main" || label.starts_with("prism-")
}

#[cfg(target_os = "macos")]
fn focus_existing_startup_file_window(app: &tauri::AppHandle, path: &str) -> bool {
    for (label, window) in app.webview_windows() {
        if !is_prism_document_window(&label) {
            continue;
        }

        let matches_path = window
            .url()
            .ok()
            .map(|url| {
                url.query_pairs()
                    .any(|(key, value)| key == "file" && value.as_ref() == path)
            })
            .unwrap_or(false);

        if matches_path {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
            return true;
        }
    }

    false
}

#[cfg(target_os = "macos")]
fn has_visible_startup_file_window(app: &tauri::AppHandle) -> bool {
    app.webview_windows().iter().any(|(label, window)| {
        is_prism_document_window(label) && window.is_visible().unwrap_or(false)
    })
}

#[cfg(target_os = "macos")]
fn should_open_startup_files_in_new_windows(has_visible_window: bool) -> bool {
    has_visible_window
}

#[cfg(target_os = "macos")]
fn queue_opened_paths_for_existing_window(app: &tauri::AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }

    let state: State<PendingFiles> = app.state();
    state.push_paths(paths.clone());
    if let Some(label) = preferred_startup_file_window_label(app) {
        let _ = app.emit_to(label, "file-opened", &paths);
    }
}

#[cfg(target_os = "macos")]
fn encode_query_component(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.as_bytes() {
        match *byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(*byte as char);
            }
            _ => {
                encoded.push_str(&format!("%{byte:02X}"));
            }
        }
    }
    encoded
}

#[cfg(target_os = "macos")]
fn startup_file_window_url(path: &str) -> PathBuf {
    PathBuf::from(format!("/?file={}", encode_query_component(path)))
}

#[cfg(target_os = "macos")]
fn startup_file_window_label(sequence: usize) -> String {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    format!("prism-opened-{stamp}-{sequence}")
}

#[cfg(target_os = "macos")]
fn open_startup_file_window(
    app: &tauri::AppHandle,
    path: &str,
    sequence: usize,
) -> tauri::Result<()> {
    /// 双击文稿开新窗时的理想尺寸，比主窗口小一档。
    const OPENED_WINDOW_SIZE: (f64, f64) = (1100.0, 760.0);

    let window = tauri::WebviewWindowBuilder::new(
        app,
        startup_file_window_label(sequence),
        tauri::WebviewUrl::App(startup_file_window_url(path)),
    )
    .title("Prism")
    .inner_size(OPENED_WINDOW_SIZE.0, OPENED_WINDOW_SIZE.1)
    .min_inner_size(900.0, 620.0)
    .resizable(true)
    .maximizable(true)
    .minimizable(true)
    .closable(true)
    .fullscreen(false)
    .decorations(true)
    .title_bar_style(tauri::TitleBarStyle::Overlay)
    .hidden_title(true)
    .visible(false)
    .build()?;

    // 与主窗口同一套收敛规则：小屏上 760 可能超出可用高度。
    if let Err(error) = crate::commands::window::fit_window_to_screen(&window, OPENED_WINDOW_SIZE) {
        eprintln!("[window] Failed to fit opened file window to screen: {error}");
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn preferred_startup_file_window_label(app: &tauri::AppHandle) -> Option<String> {
    let mut best: Option<(String, u8)> = None;

    for (label, window) in app.webview_windows() {
        if !is_prism_document_window(&label) {
            continue;
        }

        let is_visible = window.is_visible().unwrap_or(false);
        let is_focused = window.is_focused().unwrap_or(false);
        let has_file_url = window
            .url()
            .ok()
            .map(|url| {
                url.query_pairs()
                    .any(|(key, value)| key == "file" && !value.trim().is_empty())
            })
            .unwrap_or(false);

        let priority = startup_file_window_priority(&label, is_visible, is_focused, has_file_url);
        if best
            .as_ref()
            .map(|(_, best_priority)| priority > *best_priority)
            .unwrap_or(true)
        {
            best = Some((label, priority));
        }
    }

    best.map(|(label, _)| label)
}

#[cfg(target_os = "macos")]
fn startup_file_window_priority(
    label: &str,
    is_visible: bool,
    is_focused: bool,
    has_file_url: bool,
) -> u8 {
    if is_focused && has_file_url {
        return 6;
    }
    if is_visible && has_file_url {
        return 5;
    }
    if is_focused {
        return 4;
    }
    if is_visible {
        return 3;
    }
    if label == "main" {
        return 2;
    }
    1
}

const DOCUMENT_EXTENSIONS: &[&str] = &[
    "md", "markdown", "txt", "text", "sql", "json", "jsonc", "yaml", "yml", "toml", "xml", "csv",
    "tsv", "log", "ini", "conf", "env",
];

fn extension_for_path(path: &Path) -> Option<String> {
    let name = path.file_name()?.to_string_lossy();
    let (_, extension) = name.rsplit_once('.')?;
    if extension.is_empty() {
        None
    } else {
        Some(extension.to_ascii_lowercase())
    }
}

fn is_supported_startup_document_path(path: &Path) -> bool {
    extension_for_path(path)
        .map(|extension| {
            DOCUMENT_EXTENSIONS
                .iter()
                .any(|allowed| extension.eq_ignore_ascii_case(allowed))
        })
        .unwrap_or(false)
}

fn filter_supported_startup_file_paths<I, S>(paths: I) -> Vec<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let mut seen = HashSet::new();
    paths
        .into_iter()
        .filter_map(|path| {
            let path_text = path.as_ref();
            let candidate = Path::new(path_text);
            if is_supported_startup_document_path(candidate) && seen.insert(path_text.to_string()) {
                Some(path_text.to_string())
            } else {
                None
            }
        })
        .collect()
}

fn extract_file_paths_from_args() -> Vec<String> {
    filter_supported_startup_file_paths(std::env::args().skip(1))
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
    fn filters_supported_document_startup_paths_and_preserves_order_without_preflight_exists() {
        let root = unique_temp_dir();
        fs::create_dir_all(&root).unwrap();
        let md = write_fixture(&root, "first.md");
        let txt = write_fixture(&root, "notes.txt");
        let sql = write_fixture(&root, "query.sql");
        let json = write_fixture(&root, "settings.json");
        let env = write_fixture(&root, ".env");
        let ts = write_fixture(&root, "app.ts");
        let markdown = write_fixture(&root, "中文 文档.markdown");
        let missing = root.join("missing.md").to_string_lossy().to_string();

        let filtered = filter_supported_startup_file_paths([
            md.clone(),
            txt.clone(),
            sql.clone(),
            json.clone(),
            env.clone(),
            ts,
            missing.clone(),
            markdown.clone(),
        ]);

        assert_eq!(filtered, vec![md, txt, sql, json, env, missing, markdown]);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn filters_duplicate_startup_document_paths_without_changing_first_occurrence_order() {
        let root = unique_temp_dir();
        fs::create_dir_all(&root).unwrap();
        let md = write_fixture(&root, "first.md");
        let txt = write_fixture(&root, "notes.txt");

        let filtered =
            filter_supported_startup_file_paths([md.clone(), txt.clone(), md.clone(), txt.clone()]);

        assert_eq!(filtered, vec![md, txt]);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn pending_files_deduplicate_against_existing_queue() {
        let pending = PendingFiles::default();
        pending.push_paths(vec!["/tmp/a.md".into(), "/tmp/b.txt".into()]);
        pending.push_paths(vec!["/tmp/a.md".into(), "/tmp/c.json".into()]);

        assert_eq!(
            pending.files.lock().unwrap().clone(),
            vec![
                "/tmp/a.md".to_string(),
                "/tmp/b.txt".to_string(),
                "/tmp/c.json".to_string(),
            ],
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn startup_file_events_prefer_visible_document_windows_over_hidden_main() {
        assert!(
            startup_file_window_priority("prism-1", true, false, true)
                > startup_file_window_priority("main", false, false, false)
        );
        assert!(
            startup_file_window_priority("prism-1", false, true, true)
                > startup_file_window_priority("prism-2", true, false, true)
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn visible_running_document_windows_route_system_opens_to_new_windows() {
        assert!(should_open_startup_files_in_new_windows(true));
        assert!(!should_open_startup_files_in_new_windows(false));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn startup_file_window_url_encodes_file_paths_for_bootstrap() {
        assert_eq!(
            startup_file_window_url("/tmp/中文 文档.markdown").to_string_lossy(),
            "/?file=%2Ftmp%2F%E4%B8%AD%E6%96%87%20%E6%96%87%E6%A1%A3.markdown",
        );
        assert_eq!(
            startup_file_window_url("C:/docs/a+b.md").to_string_lossy(),
            "/?file=C%3A%2Fdocs%2Fa%2Bb.md",
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn startup_file_window_labels_stay_in_document_window_namespace() {
        let first = startup_file_window_label(0);
        let second = startup_file_window_label(1);

        assert!(first.starts_with("prism-opened-"));
        assert!(second.starts_with("prism-opened-"));
        assert_ne!(first, second);
    }

    #[test]
    fn accepts_startup_document_extensions_case_insensitively() {
        let root = unique_temp_dir();
        fs::create_dir_all(&root).unwrap();
        let upper_md = write_fixture(&root, "UPPER.MD");
        let upper_markdown = write_fixture(&root, "UPPER.MARKDOWN");
        let upper_json = write_fixture(&root, "SETTINGS.JSON");

        let filtered = filter_supported_startup_file_paths([
            upper_md.clone(),
            upper_markdown.clone(),
            upper_json.clone(),
        ]);

        assert_eq!(filtered, vec![upper_md, upper_markdown, upper_json]);
        fs::remove_dir_all(root).unwrap();
    }
}
