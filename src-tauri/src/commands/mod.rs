// Public Tauri command facade.
//
// Command implementations are organized by backend domain and re-exported here for
// shared backend use. `lib.rs` registers Tauri handlers against their concrete module
// paths so the command macros stay attached to the defining module.
pub(crate) mod app;
pub(crate) mod dialogs;
pub(crate) mod filesystem;
pub(crate) mod git_commands;
pub(crate) mod git_sync;
pub(crate) mod google_calendar_commands;
pub(crate) mod gtd_habits;
pub(crate) mod gtd_habits_domain;
pub(crate) mod gtd_projects;
pub(crate) mod gtd_relationships;
pub(crate) mod search;
pub(crate) mod seed_data;
pub(crate) mod settings;
pub(crate) mod utils;
pub(crate) mod watcher;
pub(crate) mod workspace;

#[allow(unused_imports)]
pub use app::{check_permissions, get_app_version, ping, test_select_folder, PermissionStatus};
#[allow(unused_imports)]
pub use dialogs::{open_file_location, open_folder_in_explorer, select_folder};
#[allow(unused_imports)]
pub use filesystem::{
    check_directory_exists, check_file_exists, copy_file, create_directory, create_file,
    delete_file, delete_folder, list_markdown_files, list_project_actions, move_file, read_file,
    rename_file, replace_in_file, save_file, FileOperationResult, MarkdownFile,
};
#[allow(unused_imports)]
pub use git_commands::{git_sync_pull, git_sync_push, git_sync_status};
#[allow(unused_imports)]
pub use google_calendar_commands::{
    google_calendar_connect, google_calendar_disconnect, google_calendar_disconnect_simple,
    google_calendar_fetch_events, google_calendar_get_cached_events, google_calendar_get_status,
    google_calendar_is_authenticated, google_calendar_start_auth, google_calendar_sync,
    google_oauth_clear_config, google_oauth_get_config, google_oauth_has_config,
    google_oauth_store_config,
};
#[cfg(debug_assertions)]
#[allow(unused_imports)]
pub use google_calendar_commands::{google_calendar_test, google_calendar_test_async};
#[allow(unused_imports)]
pub use gtd_habits::{check_and_reset_habits, create_gtd_habit, update_habit_status};
#[allow(unused_imports)]
pub use gtd_projects::{
    create_gtd_action, create_gtd_project, list_gtd_projects, rename_gtd_action,
    rename_gtd_project, GTDProject,
};
#[allow(unused_imports)]
pub use gtd_relationships::{
    find_habits_referencing, find_reverse_relationships, HabitReference, ReverseRelationship,
};
#[allow(unused_imports)]
pub use search::{search_files, SearchFilters, SearchResponse, SearchResult};
#[allow(unused_imports)]
pub use settings::{
    load_settings, save_settings, secure_store_get, secure_store_remove, secure_store_set,
    UserSettings,
};
#[allow(unused_imports)]
pub use watcher::{start_file_watcher, stop_file_watcher, FileChangeEvent};
#[allow(unused_imports)]
pub use workspace::{
    check_is_gtd_space, get_default_gtd_space_path, initialize_default_gtd_space,
    initialize_gtd_space, seed_example_gtd_content,
};
