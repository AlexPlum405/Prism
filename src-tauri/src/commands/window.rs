use tauri::{LogicalSize, WebviewWindow};

use crate::domain::window_fit::fit_size;

/// 主窗口的理想开窗尺寸（逻辑像素）。实际开多大由 [`fit_window_to_screen`] 按屏幕收敛。
pub const DEFAULT_WINDOW_SIZE: (f64, f64) = (1240.0, 840.0);

/// 把窗口收到当前屏幕可用区内并居中。
///
/// 只在窗口显示前调用：先改尺寸再居中，用户看不到中间态。
pub fn fit_window_to_screen(window: &WebviewWindow, preferred: (f64, f64)) -> tauri::Result<()> {
    let work_area = window
        .current_monitor()?
        .or_else(|| window.primary_monitor().ok().flatten())
        .map(|monitor| {
            let area = monitor.work_area();
            let scale = monitor.scale_factor();
            (
                area.size.width as f64 / scale,
                area.size.height as f64 / scale,
            )
        });

    let (width, height) = fit_size(preferred, work_area);
    window.set_size(LogicalSize::new(width, height))?;
    window.center()
}

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
