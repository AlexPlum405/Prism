use std::path::{Path, PathBuf};
use std::process::{Child, Command, Output, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use crate::{canonicalize_existing_path, first_non_empty_line};

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
pub fn move_path_to_trash(path: String) -> Result<(), String> {
    let target_path = canonicalize_existing_path(&path)?;
    move_existing_path_to_trash(&target_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn timestamp_millis() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
            .unwrap_or(0)
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
