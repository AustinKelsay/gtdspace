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
            commands::check_permissions
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}