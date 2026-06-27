#[tauri::command]
pub fn reveal_current_window(window: tauri::Window) -> Result<(), String> {
    window
        .show()
        .map_err(|error| format!("Failed to show Prism window: {error}"))?;
    window
        .set_focus()
        .map_err(|error| format!("Failed to focus Prism window: {error}"))?;
    Ok(())
}
