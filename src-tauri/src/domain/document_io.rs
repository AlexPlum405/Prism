use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;

use super::error::{PrismCommandError, PrismResult};
use super::path::{canonicalize_existing_path, ensure_file, path_to_string};

const DOCUMENT_EXTENSIONS: &[&str] = &[
    "md", "markdown", "txt", "text", "sql", "json", "jsonc", "yaml", "yml", "toml", "xml", "csv",
    "tsv", "log", "ini", "conf", "env",
];

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FileSnapshotDto {
    pub mtime_ms: Option<f64>,
    pub size: Option<u64>,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentFileSessionDto {
    pub path: String,
    pub name: String,
    pub content: String,
    pub known_snapshot: Option<FileSnapshotDto>,
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WriteDocumentInput {
    pub path: String,
    pub content: String,
    pub expected_snapshot: Option<FileSnapshotDto>,
    pub create_new: Option<bool>,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentWriteResult {
    pub path: String,
    pub snapshot: FileSnapshotDto,
}

fn metadata_to_snapshot(metadata: &fs::Metadata) -> FileSnapshotDto {
    let mtime_ms = metadata
        .modified()
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as f64);

    FileSnapshotDto {
        mtime_ms,
        size: Some(metadata.len()),
    }
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or("Untitled.md")
        .to_string()
}

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

fn ensure_supported_document_path(path: &Path, stage: &str) -> PrismResult<()> {
    if is_supported_document_path(path) {
        return Ok(());
    }

    Err(PrismCommandError::new(
        "unsupported_file_type",
        "Only Markdown / Text documents are supported",
    )
    .with_path(path_to_string(path))
    .with_stage(stage))
}

fn metadata_for_file(path: &Path, stage: &str) -> PrismResult<fs::Metadata> {
    let metadata = fs::metadata(path).map_err(|error| {
        let code = match error.kind() {
            std::io::ErrorKind::NotFound => "file_not_found",
            std::io::ErrorKind::PermissionDenied => "permission_denied",
            _ => "read_failed",
        };
        PrismCommandError::new(code, format!("Failed to inspect file: {error}"))
            .with_path(path_to_string(path))
            .with_stage(stage)
    })?;

    if !metadata.is_file() {
        return Err(PrismCommandError::new("not_a_file", "Path is not a file")
            .with_path(path_to_string(path))
            .with_stage(stage));
    }

    Ok(metadata)
}

fn snapshots_changed(expected: &FileSnapshotDto, current: &FileSnapshotDto) -> bool {
    match (expected.size, current.size) {
        (Some(expected_size), Some(current_size)) => match (expected.mtime_ms, current.mtime_ms) {
            (Some(expected_mtime), Some(current_mtime)) => {
                expected_mtime != current_mtime || expected_size != current_size
            }
            _ => expected_size != current_size,
        },
        _ => false,
    }
}

pub fn get_file_snapshot(path: String) -> PrismResult<FileSnapshotDto> {
    let file_path = canonicalize_existing_path(&path, "get_file_snapshot")?;
    ensure_file(&file_path, "get_file_snapshot")?;
    Ok(metadata_to_snapshot(&metadata_for_file(
        &file_path,
        "get_file_snapshot",
    )?))
}

pub fn read_document_file(path: String) -> PrismResult<DocumentFileSessionDto> {
    let file_path = canonicalize_existing_path(&path, "read_document_file")?;
    ensure_file(&file_path, "read_document_file")?;
    ensure_supported_document_path(&file_path, "read_document_file")?;

    let content = fs::read_to_string(&file_path).map_err(|error| {
        let code = match error.kind() {
            std::io::ErrorKind::PermissionDenied => "permission_denied",
            _ => "read_failed",
        };
        PrismCommandError::new(code, format!("Failed to read document: {error}"))
            .with_path(path_to_string(&file_path))
            .with_stage("read_document_file")
    })?;
    let snapshot = metadata_to_snapshot(&metadata_for_file(&file_path, "read_document_file")?);

    Ok(DocumentFileSessionDto {
        path: path_to_string(&file_path),
        name: file_name(&file_path),
        content,
        known_snapshot: Some(snapshot),
    })
}

pub fn write_document_file(input: WriteDocumentInput) -> PrismResult<DocumentWriteResult> {
    let requested_path = input.path.trim();
    if requested_path.is_empty() {
        return Err(
            PrismCommandError::new("invalid_path", "Path cannot be empty")
                .with_path(input.path)
                .with_stage("write_document_file"),
        );
    }

    let requested = Path::new(requested_path);
    ensure_supported_document_path(requested, "write_document_file")?;

    let create_new = input.create_new.unwrap_or(false);
    let target_path = if requested.exists() {
        canonicalize_existing_path(requested_path, "write_document_file")?
    } else {
        if input.expected_snapshot.is_some() {
            return Err(
                PrismCommandError::new("external_deleted", "Document was deleted on disk")
                    .with_path(requested_path)
                    .with_stage("write_document_file"),
            );
        }
        requested.to_path_buf()
    };

    if let Some(expected_snapshot) = input.expected_snapshot.as_ref() {
        let current_snapshot =
            metadata_to_snapshot(&metadata_for_file(&target_path, "write_document_file")?);
        if snapshots_changed(expected_snapshot, &current_snapshot) {
            return Err(
                PrismCommandError::new("external_modified", "Document changed on disk")
                    .with_path(path_to_string(&target_path))
                    .with_stage("write_document_file"),
            );
        }
    }

    if create_new {
        fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&target_path)
            .and_then(|mut file| std::io::Write::write_all(&mut file, input.content.as_bytes()))
            .map_err(|error| {
                PrismCommandError::new(
                    "write_failed",
                    format!("Failed to create document: {error}"),
                )
                .with_path(path_to_string(&target_path))
                .with_stage("write_document_file")
            })?;
    } else {
        fs::write(&target_path, input.content).map_err(|error| {
            PrismCommandError::new("write_failed", format!("Failed to write document: {error}"))
                .with_path(path_to_string(&target_path))
                .with_stage("write_document_file")
        })?;
    }

    let snapshot = metadata_to_snapshot(&metadata_for_file(&target_path, "write_document_file")?);
    Ok(DocumentWriteResult {
        path: path_to_string(&target_path),
        snapshot,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn timestamp_millis() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
            .unwrap_or(0)
    }

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!(
            "prism-document-io-{}-{}-{name}",
            std::process::id(),
            timestamp_millis()
        ));
        fs::create_dir_all(&path).expect("create temp dir");
        path
    }

    #[test]
    fn reads_markdown_document_with_snapshot() {
        let dir = temp_dir("read");
        let path = dir.join("draft.md");
        fs::write(&path, "# Draft").expect("write markdown");

        let session = read_document_file(path_to_string(&path)).expect("read document");

        assert_eq!(session.name, "draft.md");
        assert_eq!(session.content, "# Draft");
        assert!(session.known_snapshot.expect("snapshot").size.is_some());

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn reads_text_document_with_snapshot() {
        let dir = temp_dir("read-text");
        let path = dir.join("query.sql");
        fs::write(&path, "select 1;").expect("write sql");

        let session = read_document_file(path_to_string(&path)).expect("read text document");

        assert_eq!(session.name, "query.sql");
        assert_eq!(session.content, "select 1;");
        assert!(session.known_snapshot.expect("snapshot").size.is_some());

        let env_path = dir.join(".env");
        fs::write(&env_path, "TOKEN=local").expect("write env");
        let env_session = read_document_file(path_to_string(&env_path)).expect("read env document");
        assert_eq!(env_session.name, ".env");

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn rejects_unsupported_document_extension() {
        let dir = temp_dir("unsupported");
        let path = dir.join("image.png");
        fs::write(&path, "png").expect("write file");

        let error = read_document_file(path_to_string(&path)).expect_err("reject png");

        assert_eq!(error.code, "unsupported_file_type");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn write_document_rejects_external_modification() {
        let dir = temp_dir("modified");
        let path = dir.join("draft.md");
        fs::write(&path, "old").expect("write old");
        let snapshot = get_file_snapshot(path_to_string(&path)).expect("snapshot");
        fs::write(&path, "external").expect("external write");

        let error = write_document_file(WriteDocumentInput {
            path: path_to_string(&path),
            content: "mine".to_string(),
            expected_snapshot: Some(snapshot),
            create_new: None,
        })
        .expect_err("external modification rejects");

        assert_eq!(error.code, "external_modified");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn write_document_rejects_external_deletion_when_snapshot_expected() {
        let dir = temp_dir("deleted");
        let path = dir.join("draft.md");

        let error = write_document_file(WriteDocumentInput {
            path: path_to_string(&path),
            content: "mine".to_string(),
            expected_snapshot: Some(FileSnapshotDto {
                mtime_ms: Some(1000.0),
                size: Some(3),
            }),
            create_new: None,
        })
        .expect_err("external deletion rejects");

        assert_eq!(error.code, "external_deleted");
        let _ = fs::remove_dir_all(dir);
    }
}
