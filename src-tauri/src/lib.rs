use serde::Serialize;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Output, Stdio};
#[cfg(target_os = "macos")]
use std::sync::mpsc;
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_fs::FsExt;

struct PendingFiles(Mutex<Vec<String>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PandocDetectionResult {
    path: String,
    detected: bool,
    version: String,
    last_checked_at: u64,
    last_error: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PandocCitationHtmlResult {
    html: String,
    warnings: String,
}

#[tauri::command]
fn get_pending_files(state: State<PendingFiles>) -> Vec<String> {
    let mut files = state.0.lock().unwrap();
    let result = files.clone();
    files.clear();
    result
}

fn timestamp_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
        .unwrap_or(0)
}

fn first_non_empty_line(text: &[u8]) -> String {
    String::from_utf8_lossy(text)
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("")
        .chars()
        .take(240)
        .collect()
}

fn bounded_lossy_text(text: &[u8], max_chars: usize) -> String {
    String::from_utf8_lossy(text)
        .trim()
        .chars()
        .take(max_chars)
        .collect()
}

#[tauri::command]
fn detect_pandoc(path: Option<String>) -> PandocDetectionResult {
    let requested_path = path.unwrap_or_default().trim().to_string();
    let executable = if requested_path.is_empty() {
        "pandoc".to_string()
    } else {
        requested_path.clone()
    };
    let checked_at = timestamp_millis();

    match Command::new(&executable).arg("--version").output() {
        Ok(output) if output.status.success() => {
            let version = first_non_empty_line(&output.stdout);
            PandocDetectionResult {
                path: requested_path,
                detected: true,
                version,
                last_checked_at: checked_at,
                last_error: String::new(),
            }
        }
        Ok(output) => {
            let stderr = first_non_empty_line(&output.stderr);
            PandocDetectionResult {
                path: requested_path,
                detected: false,
                version: String::new(),
                last_checked_at: checked_at,
                last_error: if stderr.is_empty() {
                    format!("Pandoc --version exited with status: {}", output.status)
                } else {
                    stderr
                },
            }
        }
        Err(err) => PandocDetectionResult {
            path: requested_path,
            detected: false,
            version: String::new(),
            last_checked_at: checked_at,
            last_error: format!("Failed to run pandoc: {err}"),
        },
    }
}

fn has_extension(path: &Path, allowed_extensions: &[&str]) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            let normalized = extension.to_ascii_lowercase();
            allowed_extensions
                .iter()
                .any(|allowed| normalized == allowed.trim_start_matches('.'))
        })
        .unwrap_or(false)
}

fn canonicalize_supported_file(
    path: &str,
    label: &str,
    allowed_extensions: &[&str],
) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(format!("{label} path cannot be empty"));
    }
    let file_path = canonicalize_existing_path(trimmed)?;
    if !file_path.is_file() {
        return Err(format!("{label} path is not a file"));
    }
    if !has_extension(&file_path, allowed_extensions) {
        return Err(format!(
            "{label} file type is unsupported; supported types: {}",
            allowed_extensions.join(" / ")
        ));
    }
    Ok(file_path)
}

fn build_pandoc_citation_html_args(
    bibliography_path: &Path,
    csl_style_path: Option<&Path>,
) -> Vec<String> {
    let mut args = vec![
        "--from".to_string(),
        "markdown+tex_math_dollars+tex_math_single_backslash".to_string(),
        "--to".to_string(),
        "html".to_string(),
        "--citeproc".to_string(),
        "--bibliography".to_string(),
        bibliography_path.to_string_lossy().to_string(),
        "--metadata".to_string(),
        "link-citations=true".to_string(),
        "--wrap=none".to_string(),
    ];

    if let Some(csl_path) = csl_style_path {
        args.push("--csl".to_string());
        args.push(csl_path.to_string_lossy().to_string());
    }

    args
}

#[tauri::command]
fn render_citations_with_pandoc(
    path: Option<String>,
    markdown: String,
    bibliography_path: String,
    csl_style_path: Option<String>,
) -> Result<PandocCitationHtmlResult, String> {
    let requested_path = path.unwrap_or_default().trim().to_string();
    let executable = if requested_path.is_empty() {
        "pandoc".to_string()
    } else {
        requested_path
    };
    let bibliography = canonicalize_supported_file(
        &bibliography_path,
        "Bibliography",
        &["bib", "bibtex", "json"],
    )?;
    let csl = match csl_style_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        Some(path) => Some(canonicalize_supported_file(path, "CSL style", &["csl"])?),
        None => None,
    };
    let args = build_pandoc_citation_html_args(&bibliography, csl.as_deref());

    let mut child = Command::new(&executable)
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|err| format!("Failed to run pandoc: {err}"))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(markdown.as_bytes())
            .map_err(|err| format!("Failed to write pandoc input: {err}"))?;
    } else {
        return Err("Failed to open pandoc input stream".to_string());
    }

    let output = child
        .wait_with_output()
        .map_err(|err| format!("Failed to read pandoc output: {err}"))?;

    if !output.status.success() {
        let stderr = first_non_empty_line(&output.stderr);
        return Err(if stderr.is_empty() {
            format!("Pandoc citeproc exited with status: {}", output.status)
        } else {
            stderr
        });
    }

    Ok(PandocCitationHtmlResult {
        html: String::from_utf8_lossy(&output.stdout).to_string(),
        warnings: bounded_lossy_text(&output.stderr, 4000),
    })
}

fn canonicalize_existing_path(path: &str) -> Result<PathBuf, String> {
    PathBuf::from(path)
        .canonicalize()
        .map_err(|err| format!("Failed to access path: {err}"))
}

fn is_supported_markdown_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "md" | "markdown" | "txt"
            )
        })
        .unwrap_or(false)
}

fn is_sensitive_directory(app: &AppHandle, path: &Path) -> bool {
    if path.parent().is_none() {
        return true;
    }

    if let Ok(home_path) = app.path().home_dir() {
        if let Ok(home) = home_path.canonicalize() {
            if path == home {
                return true;
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        [
            "/System",
            "/Library",
            "/Applications",
            "/bin",
            "/sbin",
            "/usr",
            "/private",
        ]
        .iter()
        .any(|prefix| path.starts_with(prefix))
    }

    #[cfg(target_os = "windows")]
    {
        let path_text = path.to_string_lossy().to_ascii_lowercase();
        path.parent().and_then(|parent| parent.parent()).is_none()
            || path_text.contains("\\windows")
            || path_text.contains("\\program files")
            || path_text.contains("\\program files (x86)")
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        [
            "/bin", "/boot", "/dev", "/etc", "/lib", "/proc", "/root", "/run", "/sbin", "/sys",
            "/usr",
        ]
        .iter()
        .any(|prefix| path.starts_with(prefix))
    }
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn wait_for_child_output_with_timeout(
    mut child: Child,
    timeout: Duration,
) -> Result<Output, String> {
    let started_at = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => {
                return child
                    .wait_with_output()
                    .map_err(|err| format!("Failed to read system trash command output: {err}"));
            }
            Ok(None) if started_at.elapsed() >= timeout => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!(
                    "Moving to system trash timed out after {} seconds",
                    timeout.as_secs()
                ));
            }
            Ok(None) => thread::sleep(Duration::from_millis(100)),
            Err(err) => return Err(format!("Failed to wait for system trash command: {err}")),
        }
    }
}

#[cfg(target_os = "macos")]
const FINDER_TRASH_SCRIPT: &str = r#"on run argv
tell application "Finder" to delete (POSIX file (item 1 of argv) as alias)
end run"#;

#[cfg(target_os = "macos")]
fn move_existing_path_to_trash(target_path: &Path) -> Result<(), String> {
    match move_existing_path_to_finder_trash(target_path) {
        Ok(()) => Ok(()),
        Err(finder_error) => move_existing_path_to_user_trash(target_path)
            .map(|_| ())
            .map_err(|fallback_error| {
                format!("{finder_error}; ~/.Trash fallback failed: {fallback_error}")
            }),
    }
}

#[cfg(target_os = "macos")]
fn move_existing_path_to_finder_trash(target_path: &Path) -> Result<(), String> {
    const TRASH_TIMEOUT: Duration = Duration::from_secs(8);

    let output = wait_for_child_output_with_timeout(
        Command::new("osascript")
            .arg("-e")
            .arg(FINDER_TRASH_SCRIPT)
            .arg("--")
            .arg(target_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|err| format!("Failed to start system trash command: {err}"))?,
        TRASH_TIMEOUT,
    )?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = first_non_empty_line(&output.stderr);
    Err(if stderr.is_empty() {
        format!("Failed to move to system trash: {}", output.status)
    } else {
        format!("Failed to move to system trash: {stderr}")
    })
}

#[cfg(target_os = "macos")]
fn move_existing_path_to_user_trash(target_path: &Path) -> Result<PathBuf, String> {
    let home = std::env::var_os("HOME").ok_or("Failed to locate the user home directory")?;
    move_existing_path_to_user_trash_dir(target_path, &PathBuf::from(home).join(".Trash"))
}

#[cfg(target_os = "macos")]
fn move_existing_path_to_user_trash_dir(
    target_path: &Path,
    trash_dir: &Path,
) -> Result<PathBuf, String> {
    std::fs::create_dir_all(trash_dir)
        .map_err(|err| format!("Failed to create system trash directory: {err}"))?;
    let file_name = target_path
        .file_name()
        .ok_or("Failed to identify the file name to delete")?
        .to_string_lossy()
        .to_string();
    let destination = unique_user_trash_path(trash_dir, &file_name)?;
    std::fs::rename(target_path, &destination)
        .map_err(|err| format!("Failed to move into ~/.Trash: {err}"))?;
    Ok(destination)
}

#[cfg(target_os = "macos")]
fn unique_user_trash_path(trash_dir: &Path, file_name: &str) -> Result<PathBuf, String> {
    let initial = trash_dir.join(file_name);
    if !initial.exists() {
        return Ok(initial);
    }

    let file_path = Path::new(file_name);
    let stem = file_path
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or(file_name);
    let extension = file_path
        .extension()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .map(|value| format!(".{value}"))
        .unwrap_or_default();

    for index in 1..1000 {
        let candidate = trash_dir.join(format!("{stem} {index}{extension}"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "Failed to generate a non-conflicting trash path for {file_name}"
    ))
}

#[cfg(not(target_os = "macos"))]
fn move_existing_path_to_trash(target_path: &Path) -> Result<(), String> {
    trash::delete(target_path).map_err(|err| format!("Failed to move to system trash: {err}"))
}

#[tauri::command]
fn grant_markdown_file_scope(app: AppHandle, path: String) -> Result<(), String> {
    let file_path = canonicalize_existing_path(&path)?;
    if !file_path.is_file() {
        return Err("Path is not a file".to_string());
    }
    if !is_supported_markdown_path(&file_path) {
        return Err("Only Markdown / Text documents can be authorized".to_string());
    }

    let scope = app.fs_scope();
    scope
        .allow_file(&file_path)
        .map_err(|err| err.to_string())?;

    if let Some(parent) = file_path.parent() {
        if !is_sensitive_directory(&app, parent) {
            scope
                .allow_directory(parent, true)
                .map_err(|err| err.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
fn grant_workspace_directory_scope(app: AppHandle, path: String) -> Result<(), String> {
    let directory_path = canonicalize_existing_path(&path)?;
    if !directory_path.is_dir() {
        return Err("Path is not a folder".to_string());
    }
    if is_sensitive_directory(&app, &directory_path) {
        return Err(
            "System directories and the user home directory cannot be authorized as a workspace"
                .to_string(),
        );
    }

    app.fs_scope()
        .allow_directory(&directory_path, true)
        .map_err(|err| err.to_string())
}

#[tauri::command]
fn move_path_to_trash(path: String) -> Result<(), String> {
    let target_path = canonicalize_existing_path(&path)?;
    move_existing_path_to_trash(&target_path)
}

#[tauri::command]
fn open_path_with_system(path: String) -> Result<(), String> {
    let target_path = canonicalize_existing_path(&path)?;

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(&target_path);
        command
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("cmd");
        command.arg("/C").arg("start").arg("").arg(&target_path);
        command
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(&target_path);
        command
    };

    let output = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|err| format!("Failed to open export file: {err}"))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = first_non_empty_line(&output.stderr);
    Err(if stderr.is_empty() {
        format!("Failed to open export file: {}", output.status)
    } else {
        format!("Failed to open export file: {stderr}")
    })
}

fn validate_pdf_output_path(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("PDF output path cannot be empty".to_string());
    }
    let target_path = PathBuf::from(trimmed);
    if target_path.exists() && target_path.is_dir() {
        return Err("PDF output path cannot be a folder".to_string());
    }
    if let Some(parent) = target_path.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            return Err("PDF output directory does not exist".to_string());
        }
    }
    if target_path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("pdf"))
        != Some(true)
    {
        return Err("PDF output path must end with .pdf".to_string());
    }
    Ok(target_path)
}

fn validate_pdf_capture_rect(x: f64, y: f64, width: f64, height: f64) -> Result<(), String> {
    if !x.is_finite() || !y.is_finite() || !width.is_finite() || !height.is_finite() {
        return Err("PDF capture area contains invalid numbers".to_string());
    }
    if width <= 0.0 || height <= 0.0 {
        return Err("PDF capture area size must be greater than 0".to_string());
    }
    if width > 20_000.0 || height > 200_000.0 {
        return Err("PDF capture area is too large; split the document and try again".to_string());
    }
    Ok(())
}

#[cfg(target_os = "macos")]
async fn capture_current_webview_pdf_macos(
    webview_window: tauri::WebviewWindow,
    output_path: PathBuf,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    use objc2::MainThreadMarker;
    use objc2_core_foundation::{CGPoint, CGRect, CGSize};
    use objc2_foundation::{NSData, NSError};
    use objc2_web_kit::{WKPDFConfiguration, WKWebView};
    use std::ptr::NonNull;

    const CREATE_PDF_TIMEOUT: Duration = Duration::from_secs(90);

    let output_path_for_capture = output_path.clone();
    let (tx, rx) = mpsc::channel();
    webview_window
        .with_webview(move |platform_webview| {
            let result = (|| -> Result<(), String> {
                if output_path_for_capture.exists() {
                    std::fs::remove_file(&output_path_for_capture)
                        .map_err(|err| format!("Failed to overwrite existing PDF file: {err}"))?;
                }

                let mtm = MainThreadMarker::new()
                    .ok_or_else(|| "WebKit PDF capture must run on the main thread".to_string())?;
                let configuration = unsafe { WKPDFConfiguration::new(mtm) };
                unsafe {
                    configuration.setRect(CGRect {
                        origin: CGPoint { x, y },
                        size: CGSize { width, height },
                    });
                }

                let output_path_for_callback = output_path_for_capture.clone();
                let tx_callback = tx.clone();
                let completion =
                    block2::RcBlock::new(move |pdf_data: *mut NSData, error: *mut NSError| {
                        let result = (|| -> Result<(), String> {
                            if !error.is_null() {
                                let description =
                                    unsafe { (&*error).localizedDescription().to_string() };
                                return Err(format!("WebKit PDF capture failed: {description}"));
                            }
                            if pdf_data.is_null() {
                                return Err("WebKit PDF capture returned no data".to_string());
                            }

                            let data = unsafe { &*pdf_data };
                            let length = data.length() as usize;
                            if length == 0 {
                                return Err("WebKit PDF capture returned empty data".to_string());
                            }

                            let mut bytes = vec![0_u8; length];
                            let buffer =
                                NonNull::new(bytes.as_mut_ptr().cast()).ok_or_else(|| {
                                    "Failed to allocate PDF capture buffer".to_string()
                                })?;
                            unsafe {
                                data.getBytes_length(buffer, length);
                            }
                            std::fs::write(&output_path_for_callback, bytes).map_err(|err| {
                                format!("Failed to write WebKit PDF capture file: {err}")
                            })?;
                            Ok(())
                        })();
                        let _ = tx_callback.send(result);
                    });

                // SAFETY: Tauri's with_webview provides the platform WKWebView pointer for the
                // current export worker window; createPDF is asynchronous and reports completion
                // through the copied block.
                unsafe {
                    let wk_webview = &*platform_webview.inner().cast::<WKWebView>();
                    wk_webview.createPDFWithConfiguration_completionHandler(
                        Some(&configuration),
                        &completion,
                    );
                }
                Ok(())
            })();
            if let Err(error) = result {
                let _ = tx.send(Err(error));
            }
        })
        .map_err(|err| format!("Failed to access export WebView: {err}"))?;

    tauri::async_runtime::spawn_blocking(move || {
        rx.recv_timeout(CREATE_PDF_TIMEOUT)
            .map_err(|_| "WebKit PDF capture timed out".to_string())?
    })
    .await
    .map_err(|err| format!("WebKit PDF capture task failed: {err}"))?
}

#[cfg(not(target_os = "macos"))]
async fn capture_current_webview_pdf_platform(
    _webview_window: tauri::WebviewWindow,
    _output_path: PathBuf,
    _x: f64,
    _y: f64,
    _width: f64,
    _height: f64,
) -> Result<(), String> {
    Err("Prism WebView PDF capture is not available on this platform yet".to_string())
}

#[cfg(target_os = "macos")]
async fn capture_current_webview_pdf_platform(
    webview_window: tauri::WebviewWindow,
    output_path: PathBuf,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    capture_current_webview_pdf_macos(webview_window, output_path, x, y, width, height).await
}

#[tauri::command]
async fn capture_current_webview_pdf(
    webview_window: tauri::WebviewWindow,
    output_path: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let target_path = validate_pdf_output_path(&output_path)?;
    validate_pdf_capture_rect(x, y, width, height)?;
    capture_current_webview_pdf_platform(webview_window, target_path, x, y, width, height).await
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    #[cfg(unix)]
    use std::time::Instant;

    fn temp_file(name: &str, contents: &str) -> PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "prism-pandoc-test-{}-{}-{}",
            std::process::id(),
            timestamp_millis(),
            name
        ));
        fs::write(&path, contents).expect("write temp file");
        path
    }

    #[cfg(target_os = "macos")]
    fn temp_dir(name: &str) -> PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "prism-test-dir-{}-{}-{}",
            std::process::id(),
            timestamp_millis(),
            name
        ));
        fs::create_dir_all(&path).expect("create temp dir");
        path
    }

    #[test]
    fn builds_pandoc_citation_html_args_with_csl() {
        let bibliography = PathBuf::from("/tmp/library.bib");
        let csl = PathBuf::from("/tmp/chinese-gb7714.csl");

        let args = build_pandoc_citation_html_args(&bibliography, Some(&csl));

        assert_eq!(args[0], "--from");
        assert!(args.contains(&"--citeproc".to_string()));
        assert!(args.contains(&"--bibliography".to_string()));
        assert!(args.contains(&"/tmp/library.bib".to_string()));
        assert!(args.contains(&"--csl".to_string()));
        assert!(args.contains(&"/tmp/chinese-gb7714.csl".to_string()));
        assert!(args.contains(&"--wrap=none".to_string()));
    }

    #[test]
    fn validates_supported_citation_files() {
        let bibliography = temp_file("library.bib", "@book{doe2024,title={Demo}}");
        let csl = temp_file("style.csl", "<style></style>");

        assert!(canonicalize_supported_file(
            bibliography.to_str().unwrap(),
            "Bibliography",
            &["bib", "bibtex", "json"],
        )
        .is_ok());
        assert!(canonicalize_supported_file(csl.to_str().unwrap(), "CSL style", &["csl"]).is_ok());

        let _ = fs::remove_file(bibliography);
        let _ = fs::remove_file(csl);
    }

    #[test]
    fn rejects_unsupported_citation_file_extension() {
        let bibliography = temp_file("library.txt", "plain text");
        let error = canonicalize_supported_file(
            bibliography.to_str().unwrap(),
            "Bibliography",
            &["bib", "bibtex", "json"],
        )
        .expect_err("txt should be rejected");

        assert!(error.contains("Bibliography file type is unsupported"));
        let _ = fs::remove_file(bibliography);
    }

    #[test]
    fn move_path_to_trash_rejects_missing_path() {
        let mut missing_path = std::env::temp_dir();
        missing_path.push(format!(
            "prism-trash-missing-{}-{}.md",
            std::process::id(),
            timestamp_millis()
        ));

        let error = move_path_to_trash(missing_path.to_string_lossy().to_string())
            .expect_err("missing path should be rejected before trashing");
        assert!(error.contains("Failed to access path"));
    }

    #[cfg(unix)]
    #[test]
    fn trash_command_wait_returns_child_output() {
        let child = Command::new("sh")
            .arg("-c")
            .arg("printf ok")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("spawn child");

        let output = wait_for_child_output_with_timeout(child, Duration::from_secs(1))
            .expect("child should finish before timeout");

        assert!(output.status.success());
        assert_eq!(String::from_utf8_lossy(&output.stdout), "ok");
    }

    #[cfg(unix)]
    #[test]
    fn trash_command_wait_times_out_and_kills_child() {
        let child = Command::new("sh")
            .arg("-c")
            .arg("sleep 5")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("spawn child");
        let started_at = Instant::now();

        let error = wait_for_child_output_with_timeout(child, Duration::from_millis(100))
            .expect_err("slow child should time out");

        assert!(error.contains("Moving to system trash timed out"));
        assert!(started_at.elapsed() < Duration::from_secs(2));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_finder_trash_script_resolves_posix_file_as_alias() {
        assert!(FINDER_TRASH_SCRIPT.contains("POSIX file (item 1 of argv) as alias"));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_user_trash_fallback_moves_file_with_unique_name() {
        let source_dir = temp_dir("trash-source");
        let trash_dir = temp_dir("trash-target");
        let existing = trash_dir.join("draft.md");
        let source = source_dir.join("draft.md");
        fs::write(&existing, "existing").expect("write existing trash file");
        fs::write(&source, "move me").expect("write source file");

        let destination = move_existing_path_to_user_trash_dir(&source, &trash_dir)
            .expect("fallback should move file to trash dir");

        assert!(!source.exists());
        assert_eq!(
            destination.file_name().and_then(|value| value.to_str()),
            Some("draft 1.md")
        );
        assert_eq!(
            fs::read_to_string(destination).expect("read moved file"),
            "move me"
        );
        assert_eq!(
            fs::read_to_string(existing).expect("read existing file"),
            "existing"
        );

        let _ = fs::remove_dir_all(source_dir);
        let _ = fs::remove_dir_all(trash_dir);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pending_files = PendingFiles(Mutex::new(Vec::new()));

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

            // Windows/Linux: 从命令行参数读取文件路径
            #[cfg(not(target_os = "macos"))]
            {
                let paths = extract_file_paths_from_args();
                if !paths.is_empty() {
                    let state: State<PendingFiles> = app.state();
                    state.0.lock().unwrap().extend(paths.clone());
                    let _ = app.emit("file-opened", &paths);
                }
            }

            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_pending_files,
            detect_pandoc,
            render_citations_with_pandoc,
            grant_markdown_file_scope,
            grant_workspace_directory_scope,
            move_path_to_trash,
            open_path_with_system,
            capture_current_webview_pdf,
            read_legacy_settings_config
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);

            // macOS: 通过 RunEvent::Opened 接收文件路径
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
        });
}
