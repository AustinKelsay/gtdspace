//! GTD Space Library
//!
//! Core library exports for the Tauri markdown editor application.

// Import command modules
mod commands;
mod google_calendar;

#[cfg(debug_assertions)]
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env file only in debug builds to avoid loading secrets in release
    #[cfg(debug_assertions)]
    {
        dotenv::dotenv().ok();
    }

    // Initialize logging for development
    #[cfg(debug_assertions)]
    {
        let _ = env_logger::try_init();
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                let window = _app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::test_select_folder,
            commands::get_app_version,
            commands::check_permissions,
            commands::get_default_gtd_space_path,
            commands::initialize_default_gtd_space,
            commands::select_folder,
            commands::open_folder_in_explorer,
            commands::open_file_location,
            commands::list_markdown_files,
            commands::list_project_actions,
            commands::read_file,
            commands::save_file,
            commands::create_file,
            commands::rename_file,
            commands::delete_file,
            commands::delete_folder,
            commands::load_settings,
            commands::save_settings,
            commands::start_file_watcher,
            commands::stop_file_watcher,
            commands::search_files,
            commands::copy_file,
            commands::move_file,
            commands::replace_in_file,
            commands::find_reverse_relationships,
            commands::check_is_gtd_space,
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
            commands::create_directory,
            commands::google_calendar_test,
            commands::google_calendar_test_async,
            commands::google_calendar_start_auth,
            commands::google_calendar_is_authenticated,
            commands::google_calendar_fetch_events,
            commands::google_calendar_connect,
            commands::google_calendar_disconnect,
            commands::google_calendar_disconnect_simple,
            commands::google_calendar_sync,
            commands::google_calendar_get_status,
            commands::google_calendar_get_cached_events
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
