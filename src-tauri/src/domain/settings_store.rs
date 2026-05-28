use std::fs;
use std::path::{Path, PathBuf};

use super::error::{PrismCommandError, PrismResult};

pub const SETTINGS_CONFIG_FILENAME: &str = "config.json";

fn settings_error(
    code: impl Into<String>,
    message: impl Into<String>,
    path: impl Into<String>,
) -> PrismCommandError {
    PrismCommandError::new(code, message)
        .with_stage("settings_store")
        .with_path(path)
}

pub fn settings_config_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(SETTINGS_CONFIG_FILENAME)
}

pub fn read_settings_file_at(app_data_dir: &Path) -> PrismResult<Option<String>> {
    let path = settings_config_path(app_data_dir);
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(&path).map(Some).map_err(|error| {
        settings_error(
            "settings_read_failed",
            format!("Failed to read settings file: {error}"),
            path.to_string_lossy(),
        )
    })
}

pub fn write_settings_file_at(app_data_dir: &Path, contents: String) -> PrismResult<()> {
    fs::create_dir_all(app_data_dir).map_err(|error| {
        settings_error(
            "settings_directory_create_failed",
            format!("Failed to create settings directory: {error}"),
            app_data_dir.to_string_lossy(),
        )
    })?;

    let path = settings_config_path(app_data_dir);
    fs::write(&path, contents).map_err(|error| {
        settings_error(
            "settings_write_failed",
            format!("Failed to write settings file: {error}"),
            path.to_string_lossy(),
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn reads_and_writes_settings_inside_app_data() {
        let root =
            std::env::temp_dir().join(format!("prism-settings-store-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);

        assert_eq!(settings_config_path(&root), root.join("config.json"));
        assert_eq!(read_settings_file_at(&root).expect("read missing"), None);

        write_settings_file_at(&root, "{\"theme\":\"dark\"}".to_string()).expect("write settings");
        assert_eq!(
            read_settings_file_at(&root).expect("read settings"),
            Some("{\"theme\":\"dark\"}".to_string())
        );

        let _ = fs::remove_dir_all(root);
    }
}
