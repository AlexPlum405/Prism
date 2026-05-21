use std::process::{Command, Stdio};

use crate::{canonicalize_existing_path, first_non_empty_line};

#[tauri::command]
pub fn open_path_with_system(path: String) -> Result<(), String> {
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
