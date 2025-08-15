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
            commands::get_default_gtd_space_path,
            commands::initialize_default_gtd_space,
            commands::select_folder,
            commands::open_folder_in_explorer,
            commands::list_markdown_files,
            commands::list_project_actions,
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
            commands::replace_in_file,
            commands::initialize_gtd_space,
            commands::seed_example_gtd_content,
            commands::create_gtd_project,
            commands::create_gtd_action,
            commands::create_gtd_habit,
            commands::update_habit_status,
            commands::check_and_reset_habits,
            commands::list_gtd_projects,
            commands::rename_gtd_project,
            commands::rename_gtd_action,
            commands::check_directory_exists,
            commands::create_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}