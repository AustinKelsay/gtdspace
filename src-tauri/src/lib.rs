//! GTD Space Library
//!
//! Core library exports for the Tauri markdown editor application.

// Import command modules
pub mod backend;
mod commands;
mod google_calendar;
pub mod mcp_server;
mod mcp_settings;
pub mod test_utils;

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

    register_handlers(tauri::Builder::default())
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(debug_assertions)]
fn register_handlers(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder.invoke_handler(tauri::generate_handler![
        commands::app::ping,
        commands::app::test_select_folder,
        commands::app::get_app_version,
        commands::app::check_permissions,
        commands::workspace::get_default_gtd_space_path,
        commands::workspace::initialize_default_gtd_space,
        commands::git_commands::git_sync_status,
        commands::git_commands::git_sync_preview_push,
        commands::git_commands::git_sync_push,
        commands::git_commands::git_sync_pull,
        commands::dialogs::select_folder,
        commands::dialogs::open_folder_in_explorer,
        commands::dialogs::open_file_location,
        commands::filesystem::list_markdown_files,
        commands::filesystem::list_project_actions,
        commands::filesystem::read_file,
        commands::filesystem::save_file,
        commands::filesystem::create_file,
        commands::filesystem::rename_file,
        commands::filesystem::delete_file,
        commands::filesystem::delete_folder,
        commands::settings::load_settings,
        commands::settings::save_settings,
        commands::settings::secure_store_set,
        commands::settings::secure_store_get,
        commands::settings::secure_store_remove,
        commands::watcher::start_file_watcher,
        commands::watcher::stop_file_watcher,
        commands::search::search_files,
        commands::filesystem::copy_file,
        commands::filesystem::move_file,
        commands::filesystem::replace_in_file,
        commands::gtd_relationships::find_reverse_relationships,
        commands::gtd_relationships::find_habits_referencing,
        commands::workspace::check_is_gtd_space,
        commands::workspace::initialize_gtd_space,
        commands::workspace::seed_example_gtd_content,
        commands::gtd_projects::create_gtd_project,
        commands::gtd_projects::create_gtd_action,
        commands::gtd_habits::create_gtd_habit,
        commands::gtd_habits::update_habit_status,
        commands::gtd_habits::check_and_reset_habits,
        commands::gtd_projects::list_gtd_projects,
        commands::gtd_projects::rename_gtd_project,
        commands::gtd_projects::rename_gtd_action,
        commands::filesystem::check_directory_exists,
        commands::filesystem::create_directory,
        commands::google_calendar_commands::google_calendar_test,
        commands::google_calendar_commands::google_calendar_test_async,
        commands::google_calendar_commands::google_calendar_start_auth,
        commands::google_calendar_commands::google_calendar_is_authenticated,
        commands::google_calendar_commands::google_calendar_fetch_events,
        commands::google_calendar_commands::google_calendar_connect,
        commands::google_calendar_commands::google_calendar_disconnect,
        commands::google_calendar_commands::google_calendar_disconnect_simple,
        commands::google_calendar_commands::google_calendar_sync,
        commands::google_calendar_commands::google_calendar_get_status,
        commands::google_calendar_commands::google_calendar_get_cached_events,
        commands::google_calendar_commands::google_oauth_store_config,
        commands::google_calendar_commands::google_oauth_get_config,
        commands::google_calendar_commands::google_oauth_clear_config,
        commands::google_calendar_commands::google_oauth_has_config,
        commands::filesystem::check_file_exists
    ])
}

#[cfg(not(debug_assertions))]
fn register_handlers(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder.invoke_handler(tauri::generate_handler![
        commands::app::ping,
        commands::app::get_app_version,
        commands::app::check_permissions,
        commands::workspace::get_default_gtd_space_path,
        commands::workspace::initialize_default_gtd_space,
        commands::git_commands::git_sync_status,
        commands::git_commands::git_sync_preview_push,
        commands::git_commands::git_sync_push,
        commands::git_commands::git_sync_pull,
        commands::dialogs::select_folder,
        commands::dialogs::open_folder_in_explorer,
        commands::dialogs::open_file_location,
        commands::filesystem::list_markdown_files,
        commands::filesystem::list_project_actions,
        commands::filesystem::read_file,
        commands::filesystem::save_file,
        commands::filesystem::create_file,
        commands::filesystem::rename_file,
        commands::filesystem::delete_file,
        commands::filesystem::delete_folder,
        commands::settings::load_settings,
        commands::settings::save_settings,
        commands::settings::secure_store_set,
        commands::settings::secure_store_get,
        commands::settings::secure_store_remove,
        commands::watcher::start_file_watcher,
        commands::watcher::stop_file_watcher,
        commands::search::search_files,
        commands::filesystem::copy_file,
        commands::filesystem::move_file,
        commands::filesystem::replace_in_file,
        commands::gtd_relationships::find_reverse_relationships,
        commands::gtd_relationships::find_habits_referencing,
        commands::workspace::check_is_gtd_space,
        commands::workspace::initialize_gtd_space,
        commands::workspace::seed_example_gtd_content,
        commands::gtd_projects::create_gtd_project,
        commands::gtd_projects::create_gtd_action,
        commands::gtd_habits::create_gtd_habit,
        commands::gtd_habits::update_habit_status,
        commands::gtd_habits::check_and_reset_habits,
        commands::gtd_projects::list_gtd_projects,
        commands::gtd_projects::rename_gtd_project,
        commands::gtd_projects::rename_gtd_action,
        commands::filesystem::check_directory_exists,
        commands::filesystem::create_directory,
        commands::google_calendar_commands::google_calendar_start_auth,
        commands::google_calendar_commands::google_calendar_is_authenticated,
        commands::google_calendar_commands::google_calendar_fetch_events,
        commands::google_calendar_commands::google_calendar_connect,
        commands::google_calendar_commands::google_calendar_disconnect,
        commands::google_calendar_commands::google_calendar_disconnect_simple,
        commands::google_calendar_commands::google_calendar_sync,
        commands::google_calendar_commands::google_calendar_get_status,
        commands::google_calendar_commands::google_calendar_get_cached_events,
        commands::google_calendar_commands::google_oauth_store_config,
        commands::google_calendar_commands::google_oauth_get_config,
        commands::google_calendar_commands::google_oauth_clear_config,
        commands::google_calendar_commands::google_oauth_has_config,
        commands::filesystem::check_file_exists
    ])
}
