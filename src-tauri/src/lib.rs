use std::path::PathBuf;

use tauri::Manager;

mod commands;
mod domain;

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
fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg(target_os = "macos")]
fn handle_macos_window_lifecycle(app: &tauri::AppHandle, event: &tauri::RunEvent) {
    match event {
        tauri::RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::CloseRequested { api, .. },
            ..
        } if label == "main" => {
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
                show_main_window(app);
            }
        }
        tauri::RunEvent::Opened { .. } => {
            show_main_window(app);
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

            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::startup_files::get_pending_files,
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
