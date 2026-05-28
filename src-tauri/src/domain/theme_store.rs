use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

use super::error::{PrismCommandError, PrismResult};
use super::path::path_to_string;

pub const THEMES_DIRECTORY_NAME: &str = "themes";
pub const THEME_MANIFEST_FILENAME: &str = "theme.json";
pub const THEME_CSS_FILENAME: &str = "theme.css";

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThemePackageSourceDto {
    pub directory: String,
    pub id: String,
    pub manifest: String,
    pub css: String,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InvalidThemePackageDto {
    pub id: String,
    pub name: String,
    pub directory: String,
    pub error: String,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ThemeScanResultDto {
    pub valid: Vec<ThemePackageSourceDto>,
    pub invalid: Vec<InvalidThemePackageDto>,
}

fn theme_error(
    code: impl Into<String>,
    message: impl Into<String>,
    path: impl Into<String>,
) -> PrismCommandError {
    PrismCommandError::new(code, message)
        .with_stage("theme_store")
        .with_path(path)
}

fn file_stem(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_string()
}

pub fn themes_directory(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(THEMES_DIRECTORY_NAME)
}

pub fn ensure_themes_directory_at(app_data_dir: &Path) -> PrismResult<PathBuf> {
    let themes_dir = themes_directory(app_data_dir);
    fs::create_dir_all(&themes_dir).map_err(|error| {
        theme_error(
            "theme_directory_create_failed",
            format!("Failed to create themes directory: {error}"),
            path_to_string(&themes_dir),
        )
    })?;
    Ok(themes_dir)
}

pub fn read_theme_package_source_at(theme_directory: &Path) -> PrismResult<ThemePackageSourceDto> {
    let id = file_stem(theme_directory);
    let manifest_path = theme_directory.join(THEME_MANIFEST_FILENAME);
    let css_path = theme_directory.join(THEME_CSS_FILENAME);

    if !manifest_path.is_file() {
        return Err(theme_error(
            "theme_manifest_missing",
            "theme.json is missing",
            path_to_string(&manifest_path),
        ));
    }
    if !css_path.is_file() {
        return Err(theme_error(
            "theme_css_missing",
            "theme.css is missing",
            path_to_string(&css_path),
        ));
    }

    let manifest = fs::read_to_string(&manifest_path).map_err(|error| {
        theme_error(
            "theme_manifest_read_failed",
            format!("Failed to read theme.json: {error}"),
            path_to_string(&manifest_path),
        )
    })?;
    let css = fs::read_to_string(&css_path).map_err(|error| {
        theme_error(
            "theme_css_read_failed",
            format!("Failed to read theme.css: {error}"),
            path_to_string(&css_path),
        )
    })?;

    Ok(ThemePackageSourceDto {
        directory: path_to_string(theme_directory),
        id,
        manifest,
        css,
    })
}

pub fn scan_installed_themes_at(app_data_dir: &Path) -> PrismResult<ThemeScanResultDto> {
    let themes_dir = ensure_themes_directory_at(app_data_dir)?;
    let entries = fs::read_dir(&themes_dir).map_err(|error| {
        theme_error(
            "theme_scan_failed",
            format!("Failed to scan themes directory: {error}"),
            path_to_string(&themes_dir),
        )
    })?;

    let mut valid = Vec::new();
    let mut invalid = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        let name = file_stem(&path);
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() || file_type.is_symlink() {
            continue;
        }

        match read_theme_package_source_at(&path) {
            Ok(theme) => valid.push(theme),
            Err(error) => invalid.push(InvalidThemePackageDto {
                id: name.clone(),
                name,
                directory: path_to_string(&path),
                error: error.message,
            }),
        }
    }

    valid.sort_by(|a, b| a.id.cmp(&b.id));
    invalid.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(ThemeScanResultDto { valid, invalid })
}

pub fn delete_user_theme_at(app_data_dir: &Path, theme_id: &str) -> PrismResult<()> {
    if theme_id.trim().is_empty()
        || theme_id.contains('/')
        || theme_id.contains('\\')
        || theme_id.starts_with('.')
    {
        return Err(
            PrismCommandError::new("invalid_theme_id", "Theme id is invalid")
                .with_stage("theme_store")
                .with_path(theme_id),
        );
    }

    let target = themes_directory(app_data_dir).join(theme_id);
    if target.exists() {
        fs::remove_dir_all(&target).map_err(|error| {
            theme_error(
                "theme_delete_failed",
                format!("Failed to delete user theme: {error}"),
                path_to_string(&target),
            )
        })?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn scans_valid_and_invalid_theme_packages() {
        let root = std::env::temp_dir().join(format!("prism-theme-store-{}", std::process::id()));
        let themes_dir = themes_directory(&root);
        let valid_dir = themes_dir.join("warm-paper");
        let invalid_dir = themes_dir.join("broken");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&valid_dir).expect("create valid theme");
        fs::create_dir_all(&invalid_dir).expect("create invalid theme");
        fs::write(
            valid_dir.join(THEME_MANIFEST_FILENAME),
            "{\"id\":\"warm-paper\"}",
        )
        .expect("write manifest");
        fs::write(valid_dir.join(THEME_CSS_FILENAME), "body{}").expect("write css");

        let result = scan_installed_themes_at(&root).expect("scan themes");
        assert_eq!(result.valid.len(), 1);
        assert_eq!(result.valid[0].id, "warm-paper");
        assert_eq!(result.valid[0].css, "body{}");
        assert_eq!(result.invalid.len(), 1);
        assert_eq!(result.invalid[0].id, "broken");

        delete_user_theme_at(&root, "warm-paper").expect("delete theme");
        assert!(!valid_dir.exists());
        let _ = fs::remove_dir_all(root);
    }
}
