use std::{
    fs,
    path::{Path, PathBuf},
};

use serde::Serialize;

use crate::domain::error::{PrismCommandError, PrismResult};

pub const INITIAL_DOCUMENTS_MARKER_FILENAME: &str = "initial-documents-v2.json";
pub const INITIAL_DOCUMENTS_TARGET_DIRNAME: &str = "Prism";

const WELCOME_DOCUMENT_PARTS: &[&str] = &["Examples", "Prism Markdown 语法指南.md"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InitialDocumentsSeedResult {
    pub target_dir: PathBuf,
    pub welcome_document_path: Option<PathBuf>,
    pub copied_files: usize,
    pub skipped_files: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InitialDocumentsMarker<'a> {
    target_dir: &'a str,
    copied_files: usize,
    skipped_files: usize,
}

fn io_error(
    code: &'static str,
    message: impl Into<String>,
    path: &Path,
    error: std::io::Error,
) -> PrismCommandError {
    PrismCommandError::new(code, format!("{}: {error}", message.into()))
        .with_path(path.to_string_lossy())
        .with_stage("initial_documents")
}

fn marker_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(INITIAL_DOCUMENTS_MARKER_FILENAME)
}

fn welcome_document_path(target_dir: &Path) -> PathBuf {
    WELCOME_DOCUMENT_PARTS
        .iter()
        .fold(target_dir.to_path_buf(), |path, part| path.join(part))
}

fn copy_dir_without_overwrite(
    source_dir: &Path,
    target_dir: &Path,
    copied_files: &mut usize,
    skipped_files: &mut usize,
) -> PrismResult<()> {
    fs::create_dir_all(target_dir).map_err(|error| {
        io_error(
            "initial_documents_create_dir_failed",
            "Failed to create initial documents target directory",
            target_dir,
            error,
        )
    })?;

    for entry in fs::read_dir(source_dir).map_err(|error| {
        io_error(
            "initial_documents_read_resource_failed",
            "Failed to read initial documents resource directory",
            source_dir,
            error,
        )
    })? {
        let entry = entry.map_err(|error| {
            io_error(
                "initial_documents_read_resource_entry_failed",
                "Failed to read initial documents resource entry",
                source_dir,
                error,
            )
        })?;
        let source_path = entry.path();
        let target_path = target_dir.join(entry.file_name());
        let file_type = entry.file_type().map_err(|error| {
            io_error(
                "initial_documents_read_resource_entry_type_failed",
                "Failed to read initial documents resource entry type",
                &source_path,
                error,
            )
        })?;

        if file_type.is_dir() {
            copy_dir_without_overwrite(&source_path, &target_path, copied_files, skipped_files)?;
            continue;
        }

        if !file_type.is_file() {
            *skipped_files += 1;
            continue;
        }

        if target_path.exists() {
            *skipped_files += 1;
            continue;
        }

        fs::copy(&source_path, &target_path).map_err(|error| {
            io_error(
                "initial_documents_copy_file_failed",
                "Failed to copy initial document",
                &target_path,
                error,
            )
        })?;
        *copied_files += 1;
    }

    Ok(())
}

fn write_marker(app_data_dir: &Path, result: &InitialDocumentsSeedResult) -> PrismResult<()> {
    fs::create_dir_all(app_data_dir).map_err(|error| {
        io_error(
            "initial_documents_create_app_data_failed",
            "Failed to create app data directory for initial documents marker",
            app_data_dir,
            error,
        )
    })?;

    let marker = InitialDocumentsMarker {
        target_dir: &result.target_dir.to_string_lossy(),
        copied_files: result.copied_files,
        skipped_files: result.skipped_files,
    };
    let contents = serde_json::to_string_pretty(&marker).map_err(|error| {
        PrismCommandError::new(
            "initial_documents_marker_encode_failed",
            format!("Failed to encode initial documents marker: {error}"),
        )
        .with_stage("initial_documents")
    })?;

    let marker_path = marker_path(app_data_dir);
    fs::write(&marker_path, contents).map_err(|error| {
        io_error(
            "initial_documents_write_marker_failed",
            "Failed to write initial documents marker",
            &marker_path,
            error,
        )
    })
}

pub fn seed_initial_documents_at(
    resource_dir: &Path,
    documents_dir: &Path,
    app_data_dir: &Path,
) -> PrismResult<Option<InitialDocumentsSeedResult>> {
    if marker_path(app_data_dir).exists() {
        return Ok(None);
    }

    if !resource_dir.is_dir() {
        return Ok(None);
    }

    let target_dir = documents_dir.join(INITIAL_DOCUMENTS_TARGET_DIRNAME);
    let mut copied_files = 0;
    let mut skipped_files = 0;
    copy_dir_without_overwrite(
        resource_dir,
        &target_dir,
        &mut copied_files,
        &mut skipped_files,
    )?;

    let welcome_document_path = welcome_document_path(&target_dir);
    let result = InitialDocumentsSeedResult {
        target_dir,
        welcome_document_path: welcome_document_path
            .exists()
            .then_some(welcome_document_path),
        copied_files,
        skipped_files,
    };
    write_marker(app_data_dir, &result)?;

    Ok(Some(result))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        sync::atomic::{AtomicU64, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };

    static TEMP_DIR_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn unique_temp_dir() -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let counter = TEMP_DIR_COUNTER.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!(
            "prism-initial-documents-{}-{stamp}-{counter}",
            std::process::id(),
        ))
    }

    #[test]
    fn seeds_initial_documents_without_overwriting_existing_files() {
        let root = unique_temp_dir();
        let resource_dir = root.join("resource");
        let documents_dir = root.join("documents");
        let app_data_dir = root.join("app-data");
        let examples_dir = resource_dir.join("Examples");
        fs::create_dir_all(&examples_dir).unwrap();
        fs::write(
            examples_dir.join("Prism Markdown 语法指南.md"),
            "# Guide from bundle\n",
        )
        .unwrap();
        fs::write(resource_dir.join("介绍 Prism.md"), "# Intro\n").unwrap();

        let target_examples_dir = documents_dir.join("Prism").join("Examples");
        fs::create_dir_all(&target_examples_dir).unwrap();
        fs::write(
            target_examples_dir.join("Prism Markdown 语法指南.md"),
            "# User edited\n",
        )
        .unwrap();

        let result = seed_initial_documents_at(&resource_dir, &documents_dir, &app_data_dir)
            .unwrap()
            .unwrap();

        assert_eq!(result.copied_files, 1);
        assert_eq!(result.skipped_files, 1);
        assert_eq!(
            fs::read_to_string(target_examples_dir.join("Prism Markdown 语法指南.md")).unwrap(),
            "# User edited\n",
        );
        assert_eq!(
            fs::read_to_string(documents_dir.join("Prism").join("介绍 Prism.md")).unwrap(),
            "# Intro\n",
        );
        assert!(marker_path(&app_data_dir).exists());
        assert_eq!(
            result.welcome_document_path,
            Some(target_examples_dir.join("Prism Markdown 语法指南.md")),
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn marker_prevents_reseeding() {
        let root = unique_temp_dir();
        let resource_dir = root.join("resource");
        let documents_dir = root.join("documents");
        let app_data_dir = root.join("app-data");
        fs::create_dir_all(&resource_dir).unwrap();
        fs::create_dir_all(&app_data_dir).unwrap();
        fs::write(resource_dir.join("a.md"), "# A\n").unwrap();
        fs::write(marker_path(&app_data_dir), "{}").unwrap();

        let result =
            seed_initial_documents_at(&resource_dir, &documents_dir, &app_data_dir).unwrap();

        assert!(result.is_none());
        assert!(!documents_dir.join("Prism").exists());

        fs::remove_dir_all(root).unwrap();
    }
}
