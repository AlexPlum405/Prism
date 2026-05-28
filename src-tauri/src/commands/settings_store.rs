use tauri::{AppHandle, Manager};

use crate::domain::error::{PrismCommandError, PrismResult};
use crate::domain::settings_store;

fn app_data_dir(app: &AppHandle) -> PrismResult<std::path::PathBuf> {
    app.path().app_data_dir().map_err(|error| {
        PrismCommandError::new(
            "settings_app_data_unavailable",
            format!("Failed to resolve app data directory: {error}"),
        )
        .with_stage("settings_store")
    })
}

#[tauri::command]
pub fn read_settings_file(app: AppHandle) -> PrismResult<Option<String>> {
    settings_store::read_settings_file_at(&app_data_dir(&app)?)
}

#[tauri::command]
pub fn write_settings_file(app: AppHandle, contents: String) -> PrismResult<()> {
    settings_store::write_settings_file_at(&app_data_dir(&app)?, contents)
}
