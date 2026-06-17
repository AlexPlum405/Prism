use std::path::Path;

use tauri::{AppHandle, Manager};
use tauri_plugin_fs::FsExt;

use crate::{canonicalize_existing_path, domain::path};

const DOCUMENT_EXTENSIONS: &[&str] = &[
    "md", "markdown", "txt", "text", "sql", "json", "jsonc", "yaml", "yml", "toml", "xml",
    "csv", "tsv", "log", "ini", "conf", "env",
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

fn is_supported_document_path(path: &Path) -> bool {
    extension_for_path(path)
        .map(|extension| {
            DOCUMENT_EXTENSIONS
                .iter()
                .any(|allowed| extension.eq_ignore_ascii_case(allowed))
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

#[tauri::command]
pub fn grant_markdown_file_scope(app: AppHandle, path: String) -> Result<(), String> {
    let file_path = canonicalize_existing_path(&path)?;
    path::ensure_file(&file_path, "grant_markdown_file_scope").map_err(|error| error.message)?;
    if !is_supported_document_path(&file_path) {
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
pub fn grant_workspace_directory_scope(app: AppHandle, path: String) -> Result<(), String> {
    let directory_path = canonicalize_existing_path(&path)?;
    path::ensure_directory(&directory_path, "grant_workspace_directory_scope")
        .map_err(|error| error.message)?;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_supported_document_extensions() {
        assert!(is_supported_document_path(Path::new("draft.md")));
        assert!(is_supported_document_path(Path::new("draft.markdown")));
        assert!(is_supported_document_path(Path::new("notes.TXT")));
        assert!(is_supported_document_path(Path::new("query.SQL")));
        assert!(is_supported_document_path(Path::new(".env")));
    }

    #[test]
    fn rejects_unsupported_document_extensions() {
        assert!(!is_supported_document_path(Path::new("image.png")));
        assert!(!is_supported_document_path(Path::new("draft")));
        assert!(!is_supported_document_path(Path::new("app.ts")));
    }
}
