use tauri::{AppHandle, Manager};

use crate::domain::error::{PrismCommandError, PrismResult};
use crate::domain::path::path_to_string;
use crate::domain::theme_store::{self, ThemePackageSourceDto, ThemeScanResultDto};

fn app_data_dir(app: &AppHandle) -> PrismResult<std::path::PathBuf> {
    app.path().app_data_dir().map_err(|error| {
        PrismCommandError::new(
            "theme_app_data_unavailable",
            format!("Failed to resolve app data directory: {error}"),
        )
        .with_stage("theme_store")
    })
}

#[tauri::command]
pub fn get_themes_directory(app: AppHandle) -> PrismResult<String> {
    let themes_dir = theme_store::ensure_themes_directory_at(&app_data_dir(&app)?)?;
    Ok(path_to_string(&themes_dir))
}

#[tauri::command]
pub fn scan_installed_themes(app: AppHandle) -> PrismResult<ThemeScanResultDto> {
    theme_store::scan_installed_themes_at(&app_data_dir(&app)?)
}

#[tauri::command]
pub fn read_theme_package_source(theme_directory: String) -> PrismResult<ThemePackageSourceDto> {
    theme_store::read_theme_package_source_at(std::path::Path::new(&theme_directory))
}

#[tauri::command]
pub fn delete_user_theme(app: AppHandle, theme_id: String) -> PrismResult<()> {
    theme_store::delete_user_theme_at(&app_data_dir(&app)?, &theme_id)
}

#[tauri::command]
pub fn open_themes_directory(app: AppHandle) -> PrismResult<()> {
    let themes_dir = theme_store::ensure_themes_directory_at(&app_data_dir(&app)?)?;
    tauri_plugin_opener::open_path(path_to_string(&themes_dir), None::<&str>).map_err(|error| {
        PrismCommandError::new(
            "theme_directory_open_failed",
            format!("Failed to open themes directory: {error}"),
        )
        .with_stage("theme_store")
        .with_path(path_to_string(&themes_dir))
    })
}
