use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

fn legacy_settings_config_path(app_data: &Path) -> PathBuf {
    PathBuf::from(format!("{}{}", app_data.to_string_lossy(), "config.json"))
}

#[tauri::command]
pub fn read_legacy_settings_config(app: AppHandle) -> Result<Option<String>, String> {
    let app_data = app.path().app_data_dir().map_err(|err| err.to_string())?;
    let config_path = app_data.join("config.json");
    if config_path.exists() {
        return Ok(None);
    }

    let legacy_path = legacy_settings_config_path(&app_data);
    if legacy_path == config_path || !legacy_path.is_file() {
        return Ok(None);
    }

    std::fs::read_to_string(legacy_path)
        .map(Some)
        .map_err(|err| format!("Failed to read legacy settings file: {err}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_legacy_settings_path_without_separator_for_compatibility() {
        let app_data = PathBuf::from("/tmp/prism-app-data");

        assert_eq!(
            legacy_settings_config_path(&app_data),
            PathBuf::from("/tmp/prism-app-dataconfig.json")
        );
    }
}
