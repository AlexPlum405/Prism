use std::io;
use std::path::{Path, PathBuf};

use super::error::{PrismCommandError, PrismResult};

fn path_error_code(error: &io::Error) -> &'static str {
    match error.kind() {
        io::ErrorKind::NotFound => "file_not_found",
        io::ErrorKind::PermissionDenied => "permission_denied",
        _ => "invalid_path",
    }
}

pub fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

pub fn canonicalize_existing_path(path: &str, stage: &str) -> PrismResult<PathBuf> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(
            PrismCommandError::new("invalid_path", "Path cannot be empty")
                .with_path(path)
                .with_hint("Choose a valid local path")
                .with_stage(stage),
        );
    }

    PathBuf::from(trimmed).canonicalize().map_err(|error| {
        PrismCommandError::new(
            path_error_code(&error),
            format!("Failed to access path: {error}"),
        )
        .with_path(trimmed)
        .with_stage(stage)
    })
}

pub fn ensure_file(path: &Path, stage: &str) -> PrismResult<()> {
    if !path.exists() {
        return Err(
            PrismCommandError::new("file_not_found", "File does not exist")
                .with_path(path_to_string(path))
                .with_stage(stage),
        );
    }

    if !path.is_file() {
        return Err(PrismCommandError::new("not_a_file", "Path is not a file")
            .with_path(path_to_string(path))
            .with_stage(stage));
    }

    Ok(())
}

pub fn ensure_directory(path: &Path, stage: &str) -> PrismResult<()> {
    if !path.exists() {
        return Err(
            PrismCommandError::new("file_not_found", "Directory does not exist")
                .with_path(path_to_string(path))
                .with_stage(stage),
        );
    }

    if !path.is_dir() {
        return Err(
            PrismCommandError::new("not_a_directory", "Path is not a directory")
                .with_path(path_to_string(path))
                .with_stage(stage),
        );
    }

    Ok(())
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

    fn temp_dir(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "prism-domain-path-{}-{}-{name}",
            std::process::id(),
            timestamp_millis()
        ));
        fs::create_dir_all(&path).expect("create temp dir");
        path
    }

    #[test]
    fn canonicalize_existing_path_rejects_empty_path() {
        let error = canonicalize_existing_path("  ", "test").expect_err("empty path rejects");

        assert_eq!(error.code, "invalid_path");
        assert_eq!(error.stage, Some("test".to_string()));
    }

    #[test]
    fn canonicalize_existing_path_returns_structured_not_found_error() {
        let missing = std::env::temp_dir().join(format!(
            "prism-domain-missing-{}-{}.md",
            std::process::id(),
            timestamp_millis()
        ));

        let error = canonicalize_existing_path(&path_to_string(&missing), "open")
            .expect_err("missing path rejects");

        assert_eq!(error.code, "file_not_found");
        assert_eq!(error.path, Some(path_to_string(&missing)));
        assert_eq!(error.stage, Some("open".to_string()));
        assert!(error.message.contains("Failed to access path"));
    }

    #[test]
    fn ensure_file_and_directory_validate_path_kinds() {
        let dir = temp_dir("kind");
        let file = dir.join("draft.md");
        fs::write(&file, "hello").expect("write test file");

        assert!(ensure_file(&file, "read").is_ok());
        assert!(ensure_directory(&dir, "scan").is_ok());

        let file_error = ensure_file(&dir, "read").expect_err("dir is not file");
        assert_eq!(file_error.code, "not_a_file");

        let dir_error = ensure_directory(&file, "scan").expect_err("file is not dir");
        assert_eq!(dir_error.code, "not_a_directory");

        let _ = fs::remove_file(file);
        let _ = fs::remove_dir_all(dir);
    }
}
