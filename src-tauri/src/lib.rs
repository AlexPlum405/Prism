use std::path::PathBuf;

use serde::Serialize;
use tauri::{Emitter, Manager};

mod commands;
mod domain;

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

fn emit_frontend_command(app: &tauri::AppHandle, action: &'static str) {
    if let Err(error) = app.emit("prism-command", NativeCommandPayload { action }) {
        eprintln!("[menu] Failed to emit command {action}: {error}");
    }
}

fn command_menu_item<R: tauri::Runtime, M: tauri::Manager<R>>(
    manager: &M,
    command: &'static str,
    label: &'static str,
    accelerator: Option<&'static str>,
) -> tauri::Result<tauri::menu::MenuItem<R>> {
    let mut builder = tauri::menu::MenuItemBuilder::with_id(format!("command:{command}"), label);
    if let Some(accelerator) = accelerator {
        builder = builder.accelerator(accelerator);
    }
    builder.build(manager)
}

fn install_app_menu(app: &mut tauri::App) -> tauri::Result<()> {
    use tauri::menu::{
        MenuBuilder, PredefinedMenuItem, SubmenuBuilder, HELP_SUBMENU_ID, WINDOW_SUBMENU_ID,
    };

    let handle = app.handle();
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
            "设置...",
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
            "新建文稿",
            Some("CmdOrCtrl+KeyN"),
        )?)
        .item(&command_menu_item(
            handle,
            "newWindow",
            "新建窗口",
            Some("CmdOrCtrl+Shift+KeyN"),
        )?)
        .separator()
        .item(&command_menu_item(
            handle,
            "open",
            "打开文件...",
            Some("CmdOrCtrl+KeyO"),
        )?)
        .item(&command_menu_item(
            handle,
            "openFolder",
            "打开文件夹...",
            Some("CmdOrCtrl+Shift+KeyO"),
        )?)
        .item(&command_menu_item(
            handle,
            "quickOpen",
            "快速打开...",
            Some("CmdOrCtrl+KeyP"),
        )?)
        .separator()
        .item(&command_menu_item(
            handle,
            "save",
            "保存",
            Some("CmdOrCtrl+KeyS"),
        )?)
        .item(&command_menu_item(
            handle,
            "saveAs",
            "另存为...",
            Some("CmdOrCtrl+Shift+KeyS"),
        )?)
        .item(&command_menu_item(
            handle,
            "openCurrentLocation",
            "在访达中显示",
            None,
        )?)
        .separator()
        .item(&command_menu_item(
            handle,
            "closeDocument",
            "关闭文稿",
            Some("CmdOrCtrl+KeyW"),
        )?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(handle, "Edit")
        .item(&command_menu_item(
            handle,
            "undo",
            "撤销",
            Some("CmdOrCtrl+KeyZ"),
        )?)
        .item(&command_menu_item(
            handle,
            "redo",
            "重做",
            Some("CmdOrCtrl+Shift+KeyZ"),
        )?)
        .separator()
        .item(&command_menu_item(
            handle,
            "cut",
            "剪切",
            Some("CmdOrCtrl+KeyX"),
        )?)
        .item(&command_menu_item(
            handle,
            "copy",
            "复制",
            Some("CmdOrCtrl+KeyC"),
        )?)
        .item(&command_menu_item(
            handle,
            "paste",
            "粘贴",
            Some("CmdOrCtrl+KeyV"),
        )?)
        .item(&command_menu_item(
            handle,
            "pastePlain",
            "粘贴为纯文本",
            Some("CmdOrCtrl+Shift+KeyV"),
        )?)
        .separator()
        .item(&command_menu_item(
            handle,
            "selectAll",
            "全选",
            Some("CmdOrCtrl+KeyA"),
        )?)
        .separator()
        .item(&command_menu_item(
            handle,
            "showSearch",
            "查找",
            Some("CmdOrCtrl+KeyF"),
        )?)
        .item(&command_menu_item(
            handle,
            "showReplace",
            "替换",
            Some("CmdOrCtrl+KeyH"),
        )?)
        .item(&command_menu_item(
            handle,
            "workspaceSearch",
            "全文搜索",
            Some("CmdOrCtrl+Shift+KeyF"),
        )?)
        .build()?;

    let view_menu = SubmenuBuilder::new(handle, "View")
        .item(&command_menu_item(
            handle,
            "sourceMode",
            "编辑",
            Some("CmdOrCtrl+Key1"),
        )?)
        .item(&command_menu_item(
            handle,
            "splitMode",
            "分栏",
            Some("CmdOrCtrl+Key2"),
        )?)
        .item(&command_menu_item(
            handle,
            "previewMode",
            "预览",
            Some("CmdOrCtrl+Key3"),
        )?)
        .separator()
        .item(&command_menu_item(
            handle,
            "toggleSidebar",
            "切换侧边栏",
            Some("CmdOrCtrl+KeyB"),
        )?)
        .item(&command_menu_item(handle, "showOutline", "大纲", None)?)
        .separator()
        .item(&command_menu_item(
            handle,
            "actualSize",
            "实际大小",
            Some("CmdOrCtrl+Digit0"),
        )?)
        .item(&command_menu_item(
            handle,
            "zoomIn",
            "放大",
            Some("CmdOrCtrl+Equal"),
        )?)
        .item(&command_menu_item(
            handle,
            "zoomOut",
            "缩小",
            Some("CmdOrCtrl+Minus"),
        )?)
        .build()?;

    let window_menu = SubmenuBuilder::with_id(handle, WINDOW_SUBMENU_ID, "Window")
        .item(&PredefinedMenuItem::minimize(handle, Some("最小化"))?)
        .item(&PredefinedMenuItem::maximize(handle, Some("缩放"))?)
        .item(&PredefinedMenuItem::fullscreen(handle, Some("进入全屏"))?)
        .separator()
        .item(&command_menu_item(handle, "alwaysOnTop", "窗口置顶", None)?)
        .separator()
        .item(&command_menu_item(
            handle,
            "newWindow",
            "新建窗口",
            Some("CmdOrCtrl+Shift+KeyN"),
        )?)
        .build()?;

    let help_menu = SubmenuBuilder::with_id(handle, HELP_SUBMENU_ID, "Help")
        .item(&command_menu_item(handle, "showShortcuts", "快捷键", None)?)
        .item(&command_menu_item(
            handle,
            "mdReference",
            "Markdown 参考",
            None,
        )?)
        .item(&command_menu_item(
            handle,
            "migrationGuide",
            "迁移指南",
            None,
        )?)
        .item(&command_menu_item(
            handle,
            "checkUpdate",
            "检查更新...",
            None,
        )?)
        .separator()
        .item(&command_menu_item(handle, "github", "GitHub", None)?)
        .item(&command_menu_item(handle, "feedback", "反馈", None)?)
        .build()?;

    let menu = MenuBuilder::new(handle)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&window_menu)
        .item(&help_menu)
        .build()?;
    app.set_menu(menu)?;

    app.on_menu_event(|app, event| {
        let id = event.id().as_ref();
        if let Some(action) = id.strip_prefix("command:") {
            match action {
                "new" => emit_frontend_command(app, "new"),
                "newWindow" => emit_frontend_command(app, "newWindow"),
                "open" => emit_frontend_command(app, "open"),
                "openFolder" => emit_frontend_command(app, "openFolder"),
                "quickOpen" => emit_frontend_command(app, "quickOpen"),
                "save" => emit_frontend_command(app, "save"),
                "saveAs" => emit_frontend_command(app, "saveAs"),
                "openCurrentLocation" => emit_frontend_command(app, "openCurrentLocation"),
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
                "sourceMode" => emit_frontend_command(app, "sourceMode"),
                "splitMode" => emit_frontend_command(app, "splitMode"),
                "previewMode" => emit_frontend_command(app, "previewMode"),
                "toggleSidebar" => emit_frontend_command(app, "toggleSidebar"),
                "showOutline" => emit_frontend_command(app, "showOutline"),
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
            return;
        }
    });

    Ok(())
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
        tauri::RunEvent::Opened { .. } => {
            show_preferred_window(app);
        }
        _ => {}
    }
}

fn seed_initial_documents(app: &mut tauri::App) {
    let resource_dir = match app.path().resource_dir() {
        Ok(path) => path.join("Initial"),
        Err(error) => {
            eprintln!("[initial_documents] Failed to resolve resource directory: {error}");
            return;
        }
    };
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

    match domain::initial_documents::seed_initial_documents_at(
        &resource_dir,
        &documents_dir,
        &app_data_dir,
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

            commands::startup_files::register_startup_files(app);
            seed_initial_documents(app);
            install_app_menu(app)?;

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
            commands::file_scope::grant_workspace_directory_scope,
            commands::trash::move_path_to_trash,
            commands::system_open::open_path_with_system,
            commands::pdf_capture::get_pdf_capture_capability,
            commands::pdf_capture::capture_current_webview_pdf,
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
