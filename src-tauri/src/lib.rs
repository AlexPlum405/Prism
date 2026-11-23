use std::path::PathBuf;

#[cfg(target_os = "macos")]
use serde::Serialize;
#[cfg(target_os = "macos")]
use tauri::Emitter;
use tauri::Manager;

mod commands;
mod domain;

#[cfg(target_os = "macos")]
#[derive(Clone, Serialize)]
struct NativeCommandPayload<'a> {
    action: &'a str,
}

pub(crate) fn first_non_empty_line(text: &[u8]) -> String {
    String::from_utf8_lossy(text)
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("")
        .chars()
        .take(240)
        .collect()
}

pub(crate) fn canonicalize_existing_path(path: &str) -> Result<PathBuf, String> {
    domain::path::canonicalize_existing_path(path, "canonicalize").map_err(|error| error.message)
}

#[cfg(target_os = "macos")]
fn is_prism_document_window(label: &str) -> bool {
    label == "main" || label.starts_with("prism-")
}

#[cfg(target_os = "macos")]
fn show_preferred_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        return;
    }

    for (label, window) in app.webview_windows() {
        if is_prism_document_window(&label) {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
            return;
        }
    }
}

#[cfg(target_os = "macos")]
fn emit_frontend_command(app: &tauri::AppHandle, action: &'static str) {
    if let Err(error) = app.emit("prism-command", NativeCommandPayload { action }) {
        eprintln!("[menu] Failed to emit command {action}: {error}");
    }
}

#[cfg(target_os = "macos")]
fn command_menu_item<R: tauri::Runtime, M: tauri::Manager<R>>(
    manager: &M,
    command: &'static str,
    label: &str,
    accelerator: Option<&'static str>,
) -> tauri::Result<tauri::menu::MenuItem<R>> {
    let mut builder = tauri::menu::MenuItemBuilder::with_id(format!("command:{command}"), label);
    if let Some(accelerator) = accelerator {
        builder = builder.accelerator(accelerator);
    }
    builder.build(manager)
}

/// 原生菜单标签随界面语言变化。
///
/// 菜单在 app 启动时就构建，那时前端还没跑起来，所以默认用中文；前端拿到
/// 当前 locale 后调用 `update_app_menu_labels` 重建一次，语言切换时再调一次。
/// key 就是菜单动作 id（与 `command:` 前缀后面的部分一致）。
pub(crate) type AppMenuLabels = std::collections::HashMap<String, String>;

#[cfg(target_os = "macos")]
fn menu_label(labels: &AppMenuLabels, key: &str, fallback: &str) -> String {
    labels
        .get(key)
        .filter(|value| !value.trim().is_empty())
        .cloned()
        .unwrap_or_else(|| fallback.to_string())
}

#[cfg(target_os = "macos")]
fn install_app_menu(app: &mut tauri::App, labels: &AppMenuLabels) -> tauri::Result<()> {
    let handle = app.handle().clone();
    let menu = build_app_menu(&handle, labels)?;
    app.set_menu(menu)?;
    // 监听只注册一次：语言切换走 update_app_menu_labels 重建菜单，不能再挂一个 handler
    app.on_menu_event(handle_menu_event);
    Ok(())
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn update_app_menu_labels(app: tauri::AppHandle, labels: AppMenuLabels) -> Result<(), String> {
    let menu = build_app_menu(&app, &labels).map_err(|error| error.to_string())?;
    app.set_menu(menu).map_err(|error| error.to_string())?;
    Ok(())
}

/// Windows / Linux 走自绘菜单栏，原生菜单不存在，这里只做无操作的成功返回，
/// 免得前端为了平台差异再分叉一次。
#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn update_app_menu_labels(_labels: AppMenuLabels) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn build_app_menu(
    handle: &tauri::AppHandle,
    labels: &AppMenuLabels,
) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{
        MenuBuilder, PredefinedMenuItem, SubmenuBuilder, HELP_SUBMENU_ID, WINDOW_SUBMENU_ID,
    };

    let app_menu = SubmenuBuilder::new(handle, "Prism")
        .item(&PredefinedMenuItem::about(
            handle,
            Some("关于 Prism"),
            Some(tauri::menu::AboutMetadata {
                name: Some("Prism".to_string()),
                version: Some(env!("CARGO_PKG_VERSION").to_string()),
                ..Default::default()
            }),
        )?)
        .item(&command_menu_item(
            handle,
            "preferences",
            &menu_label(labels, "preferences", "设置..."),
            Some("CmdOrCtrl+,"),
        )?)
        .separator()
        .item(&PredefinedMenuItem::hide(handle, Some("隐藏 Prism"))?)
        .item(&PredefinedMenuItem::hide_others(handle, Some("隐藏其他"))?)
        .item(&PredefinedMenuItem::show_all(handle, Some("全部显示"))?)
        .separator()
        .item(&PredefinedMenuItem::quit(handle, Some("退出 Prism"))?)
        .build()?;

    let file_menu = SubmenuBuilder::new(handle, "File")
        .item(&command_menu_item(
            handle,
            "new",
            &menu_label(labels, "new", "新建文稿"),
            Some("CmdOrCtrl+KeyN"),
        )?)
        .item(&command_menu_item(
            handle,
            "newWindow",
            &menu_label(labels, "newWindow", "新建窗口"),
            Some("CmdOrCtrl+Shift+KeyN"),
        )?)
        .separator()
        .item(&command_menu_item(
            handle,
            "open",
            &menu_label(labels, "open", "打开文件..."),
            Some("CmdOrCtrl+KeyO"),
        )?)
        .item(&command_menu_item(
            handle,
            "importDocument",
            &menu_label(labels, "importDocument", "导入为 Markdown..."),
            None,
        )?)
        .item(&command_menu_item(
            handle,
            "openFolder",
            &menu_label(labels, "openFolder", "打开文件夹..."),
            Some("CmdOrCtrl+Shift+KeyO"),
        )?)
        .item(&command_menu_item(
            handle,
            "quickOpen",
            &menu_label(labels, "quickOpen", "快速打开..."),
            Some("CmdOrCtrl+Alt+KeyO"),
        )?)
        .separator()
        .item(&command_menu_item(
            handle,
            "save",
            &menu_label(labels, "save", "保存"),
            Some("CmdOrCtrl+KeyS"),
        )?)
        .item(&command_menu_item(
            handle,
            "saveAs",
            &menu_label(labels, "saveAs", "另存为..."),
            Some("CmdOrCtrl+Shift+KeyS"),
        )?)
        .item(&command_menu_item(
            handle,
            "openCurrentLocation",
            &menu_label(labels, "openCurrentLocation", "在访达中显示"),
            None,
        )?)
        .item(&command_menu_item(
            handle,
            "copyCurrentFilePath",
            &menu_label(labels, "copyCurrentFilePath", "复制当前文件路径"),
            None,
        )?)
        .separator()
        .item(&command_menu_item(
            handle,
            "closeDocument",
            &menu_label(labels, "closeDocument", "关闭文稿"),
            Some("CmdOrCtrl+KeyW"),
        )?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(handle, "Edit")
        .item(&command_menu_item(
            handle,
            "undo",
            &menu_label(labels, "undo", "撤销"),
            Some("CmdOrCtrl+KeyZ"),
        )?)
        .item(&command_menu_item(
            handle,
            "redo",
            &menu_label(labels, "redo", "重做"),
            Some("CmdOrCtrl+Shift+KeyZ"),
        )?)
        .separator()
        .item(&command_menu_item(
            handle,
            "cut",
            &menu_label(labels, "cut", "剪切"),
            Some("CmdOrCtrl+KeyX"),
        )?)
        .item(&command_menu_item(
            handle,
            "copy",
            &menu_label(labels, "copy", "复制"),
            Some("CmdOrCtrl+KeyC"),
        )?)
        // 粘贴必须交给系统预定义项：自定义菜单项的 Cmd+V 加速键会截获按键，
        // WKWebView 收不到 paste 事件，前端只能退化到 navigator.clipboard.readText，
        // 既触发系统授权弹窗又丢失 text/html 结构。
        .item(&PredefinedMenuItem::paste(handle, Some("粘贴"))?)
        .item(&command_menu_item(
            handle,
            "pastePlain",
            &menu_label(labels, "pastePlain", "粘贴为纯文本"),
            Some("CmdOrCtrl+Shift+KeyV"),
        )?)
        .separator()
        .item(&command_menu_item(
            handle,
            "selectAll",
            &menu_label(labels, "selectAll", "全选"),
            Some("CmdOrCtrl+KeyA"),
        )?)
        .separator()
        .item(&command_menu_item(
            handle,
            "showSearch",
            &menu_label(labels, "showSearch", "查找"),
            Some("CmdOrCtrl+KeyF"),
        )?)
        .item(&command_menu_item(
            handle,
            "showReplace",
            &menu_label(labels, "showReplace", "替换"),
            Some("CmdOrCtrl+KeyH"),
        )?)
        .item(&command_menu_item(
            handle,
            "workspaceSearch",
            &menu_label(labels, "workspaceSearch", "全文搜索"),
            Some("CmdOrCtrl+Shift+KeyF"),
        )?)
        .build()?;

    // 视图切换不挂加速键：Cmd+1–Cmd+6 在前端归标题级别（h1–h6），
    // 抢占会废掉写作最高频的格式化键。这里原先写的是 `CmdOrCtrl+Key1`..`Key4`，
    // 而 "Key1" 不是合法 Code 名（数字应用 `Digit1`），accelerator 解析失败，
    // 菜单既不显示快捷键也不生效——等于从来没绑上，别再改回数字键。
    let view_menu = SubmenuBuilder::new(handle, "View")
        .item(&command_menu_item(
            handle,
            "sourceMode",
            &menu_label(labels, "sourceMode", "编辑"),
            None,
        )?)
        .item(&command_menu_item(
            handle,
            "splitMode",
            &menu_label(labels, "splitMode", "分栏"),
            None,
        )?)
        .item(&command_menu_item(
            handle,
            "previewMode",
            &menu_label(labels, "previewMode", "预览"),
            None,
        )?)
        .item(&command_menu_item(
            handle,
            "wysiwygMode",
            &menu_label(labels, "wysiwygMode", "单窗"),
            None,
        )?)
        .separator()
        .item(&command_menu_item(
            handle,
            "toggleSidebar",
            &menu_label(labels, "toggleSidebar", "切换侧边栏"),
            Some("CmdOrCtrl+Shift+KeyL"),
        )?)
        .item(&command_menu_item(handle, "showOutline", &menu_label(labels, "showOutline", "大纲"), None)?)
        .item(&command_menu_item(handle, "showDocumentDiagnostics", &menu_label(labels, "showDocumentDiagnostics", "文档诊断"), None)?)
        .item(&command_menu_item(handle, "showDocumentStatistics", &menu_label(labels, "showDocumentStatistics", "写作统计"), None)?)
        .separator()
        .item(&command_menu_item(
            handle,
            "actualSize",
            &menu_label(labels, "actualSize", "实际大小"),
            Some("CmdOrCtrl+Shift+Digit9"),
        )?)
        .item(&command_menu_item(
            handle,
            "zoomIn",
            &menu_label(labels, "zoomIn", "放大"),
            Some("CmdOrCtrl+Shift+Equal"),
        )?)
        .item(&command_menu_item(
            handle,
            "zoomOut",
            &menu_label(labels, "zoomOut", "缩小"),
            Some("CmdOrCtrl+Shift+Minus"),
        )?)
        .build()?;

    let window_menu = SubmenuBuilder::with_id(handle, WINDOW_SUBMENU_ID, "Window")
        .item(&PredefinedMenuItem::minimize(handle, Some("最小化"))?)
        .item(&PredefinedMenuItem::maximize(handle, Some("缩放"))?)
        .item(&PredefinedMenuItem::fullscreen(handle, Some("进入全屏"))?)
        .separator()
        .item(&command_menu_item(handle, "alwaysOnTop", &menu_label(labels, "alwaysOnTop", "窗口置顶"), None)?)
        .build()?;

    let help_menu = SubmenuBuilder::with_id(handle, HELP_SUBMENU_ID, "Help")
        .item(&command_menu_item(handle, "showShortcuts", &menu_label(labels, "showShortcuts", "快捷键"), None)?)
        .item(&command_menu_item(
            handle,
            "mdReference",
            &menu_label(labels, "mdReference", "Markdown 参考"),
            None,
        )?)
        .item(&command_menu_item(
            handle,
            "migrationGuide",
            &menu_label(labels, "migrationGuide", "迁移指南"),
            None,
        )?)
        .item(&command_menu_item(
            handle,
            "checkUpdate",
            &menu_label(labels, "checkUpdate", "检查更新..."),
            None,
        )?)
        .separator()
        .item(&command_menu_item(handle, "github", &menu_label(labels, "github", "GitHub"), None)?)
        .item(&command_menu_item(handle, "feedback", &menu_label(labels, "feedback", "反馈"), None)?)
        .build()?;

    let menu = MenuBuilder::new(handle)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&window_menu)
        .item(&help_menu)
        .build()?;

    Ok(menu)
}

#[cfg(target_os = "macos")]
fn handle_menu_event(app: &tauri::AppHandle, event: tauri::menu::MenuEvent) {
    let id = event.id().as_ref();
    if let Some(action) = id.strip_prefix("command:") {
        match action {
            "new" => emit_frontend_command(app, "new"),
            "newWindow" => emit_frontend_command(app, "newWindow"),
            "open" => emit_frontend_command(app, "open"),
            "importDocument" => emit_frontend_command(app, "importDocument"),
            "openFolder" => emit_frontend_command(app, "openFolder"),
            "quickOpen" => emit_frontend_command(app, "quickOpen"),
            "save" => emit_frontend_command(app, "save"),
            "saveAs" => emit_frontend_command(app, "saveAs"),
            "openCurrentLocation" => emit_frontend_command(app, "openCurrentLocation"),
            "copyCurrentFilePath" => emit_frontend_command(app, "copyCurrentFilePath"),
            "closeDocument" => emit_frontend_command(app, "closeDocument"),
            "preferences" => emit_frontend_command(app, "preferences"),
            "undo" => emit_frontend_command(app, "undo"),
            "redo" => emit_frontend_command(app, "redo"),
            "cut" => emit_frontend_command(app, "cut"),
            "copy" => emit_frontend_command(app, "copy"),
            "paste" => emit_frontend_command(app, "paste"),
            "pastePlain" => emit_frontend_command(app, "pastePlain"),
            "selectAll" => emit_frontend_command(app, "selectAll"),
            "showSearch" => emit_frontend_command(app, "showSearch"),
            "showReplace" => emit_frontend_command(app, "showReplace"),
            "workspaceSearch" => emit_frontend_command(app, "workspaceSearch"),
            "wysiwygMode" => emit_frontend_command(app, "wysiwygMode"),
            "sourceMode" => emit_frontend_command(app, "sourceMode"),
            "splitMode" => emit_frontend_command(app, "splitMode"),
            "previewMode" => emit_frontend_command(app, "previewMode"),
            "toggleSidebar" => emit_frontend_command(app, "toggleSidebar"),
            "showOutline" => emit_frontend_command(app, "showOutline"),
            "showDocumentDiagnostics" => emit_frontend_command(app, "showDocumentDiagnostics"),
            "showDocumentStatistics" => emit_frontend_command(app, "showDocumentStatistics"),
            "actualSize" => emit_frontend_command(app, "actualSize"),
            "zoomIn" => emit_frontend_command(app, "zoomIn"),
            "zoomOut" => emit_frontend_command(app, "zoomOut"),
            "alwaysOnTop" => emit_frontend_command(app, "alwaysOnTop"),
            "showShortcuts" => emit_frontend_command(app, "showShortcuts"),
            "mdReference" => emit_frontend_command(app, "mdReference"),
            "migrationGuide" => emit_frontend_command(app, "migrationGuide"),
            "checkUpdate" => emit_frontend_command(app, "checkUpdate"),
            "github" => emit_frontend_command(app, "github"),
            "feedback" => emit_frontend_command(app, "feedback"),
            _ => {}
        }
    }
}

#[cfg(target_os = "macos")]
fn handle_macos_window_lifecycle(app: &tauri::AppHandle, event: &tauri::RunEvent) {
    match event {
        tauri::RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::CloseRequested { api, .. },
            ..
        } if is_prism_document_window(label) => {
            api.prevent_close();
            if let Some(window) = app.get_webview_window(label) {
                let _ = window.hide();
            }
        }
        tauri::RunEvent::Reopen {
            has_visible_windows,
            ..
        } => {
            if !has_visible_windows {
                show_preferred_window(app);
            }
        }
        _ => {}
    }
}

fn seed_initial_documents(app: &mut tauri::App) {
    let resources_root = match app.path().resource_dir() {
        Ok(path) => path.join("Initial"),
        Err(error) => {
            eprintln!("[initial_documents] Failed to resolve resource directory: {error}");
            return;
        }
    };
    let install_id_path = resources_root
        .parent()
        .map(|path| path.join("PrismInstallID"));
    let documents_dir = match app.path().document_dir() {
        Ok(path) => path,
        Err(error) => {
            eprintln!("[initial_documents] Failed to resolve documents directory: {error}");
            return;
        }
    };
    let app_data_dir = match app.path().app_data_dir() {
        Ok(path) => path,
        Err(error) => {
            eprintln!("[initial_documents] Failed to resolve app data directory: {error}");
            return;
        }
    };
    let install_id = install_id_path
        .and_then(|path| std::fs::read_to_string(path).ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    match domain::initial_documents::seed_initial_documents_at(
        &resources_root,
        &documents_dir,
        &app_data_dir,
        install_id.as_deref(),
    ) {
        Ok(Some(result)) => {
            if commands::startup_files::has_pending_files(app) {
                return;
            }

            commands::startup_files::queue_pending_workspace_path(
                app,
                result.target_dir.to_string_lossy().to_string(),
            );

            if let Some(welcome_document_path) = result.welcome_document_path {
                commands::startup_files::queue_pending_files(
                    app,
                    vec![welcome_document_path.to_string_lossy().to_string()],
                );
            }
        }
        Ok(None) => {}
        Err(error) => {
            eprintln!(
                "[initial_documents] Failed to seed bundled initial documents: {}",
                error.message
            );
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pending_files = commands::startup_files::PendingFiles::default();

    tauri::Builder::default()
        .manage(pending_files)
        .manage(domain::export_job::ExportJobStore::default())
        .manage(domain::workspace_index_job::WorkspaceIndexJobStore::default())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // 开窗前先把主窗口收到屏幕可用区内：配置里的尺寸是理想值，
            // 小屏上直接照搬会让窗口比屏幕还高。
            if let Some(window) = app.get_webview_window("main") {
                if let Err(error) = commands::window::fit_window_to_screen(
                    &window,
                    commands::window::DEFAULT_WINDOW_SIZE,
                ) {
                    eprintln!("[window] Failed to fit main window to screen: {error}");
                }
            }

            commands::startup_files::register_startup_files(app);
            seed_initial_documents(app);

            #[cfg(target_os = "macos")]
            install_app_menu(app, &AppMenuLabels::new())?;

            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::startup_files::get_pending_files,
            commands::startup_files::get_pending_workspace_path,
            commands::window::reveal_current_window,
            update_app_menu_labels,
            commands::pandoc::detect_pandoc,
            commands::pandoc::render_citations_with_pandoc,
            commands::document_io::get_file_snapshot,
            commands::document_io::read_document_file,
            commands::document_io::write_document_file,
            commands::workspace_tree::load_workspace_tree,
            commands::workspace_index::build_workspace_index,
            commands::workspace_index::query_workspace_index,
            commands::workspace_index::start_workspace_index_job,
            commands::workspace_index::get_workspace_index_job,
            commands::workspace_index::cancel_workspace_index_job,
            commands::workspace_index::query_workspace_backlinks,
            commands::workspace_index::query_workspace_relation_graph,
            commands::workspace_index::query_workspace_link_targets,
            commands::export_jobs::create_export_job,
            commands::export_jobs::update_export_job,
            commands::export_jobs::complete_export_job,
            commands::export_jobs::fail_export_job,
            commands::export_jobs::cancel_export_job,
            commands::export_jobs::get_export_job,
            commands::export_jobs::list_export_jobs,
            commands::export_resources::resolve_export_resource,
            commands::export_resources::read_export_resource,
            commands::export_resources::preflight_export,
            commands::file_scope::grant_markdown_file_scope,
            commands::file_scope::grant_import_file_scope,
            commands::file_scope::grant_workspace_directory_scope,
            commands::trash::move_path_to_trash,
            commands::system_open::open_path_with_system,
            commands::pdf_capture::get_pdf_capture_capability,
            commands::pdf_capture::capture_current_webview_pdf,
            commands::clipboard::write_clipboard_rich,
            commands::clipboard::read_clipboard_payload,
            commands::settings_store::read_settings_file,
            commands::settings_store::write_settings_file,
            commands::theme_store::get_themes_directory,
            commands::theme_store::scan_installed_themes,
            commands::theme_store::read_theme_package_source,
            commands::theme_store::delete_user_theme,
            commands::theme_store::open_themes_directory,
            commands::settings::read_legacy_settings_config
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            commands::startup_files::handle_opened_event(app, &event);

            #[cfg(target_os = "macos")]
            handle_macos_window_lifecycle(app, &event);
        });
}
