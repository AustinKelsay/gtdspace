//! GTD Space Library
//!
//! Core library exports for the Tauri markdown editor application.

use tauri::Manager;

// Import command modules  
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging for development
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::get_app_version,
            commands::check_permissions,
            commands::select_folder,
            commands::list_markdown_files,
            commands::read_file,
            commands::save_file,
            commands::create_file,
            commands::rename_file,
            commands::delete_file,
            commands::load_settings,
            commands::save_settings,
            commands::start_file_watcher,
            commands::stop_file_watcher,
            commands::search_files,
            commands::copy_file,
            commands::move_file,
            commands::replace_in_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}