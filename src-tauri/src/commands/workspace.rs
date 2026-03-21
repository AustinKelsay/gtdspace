//! GTD workspace initialization and validation commands.

use chrono::{Datelike, Timelike};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

use super::gtd_projects::{create_gtd_action, create_gtd_project};
use super::seed_data::{
    areas_of_focus_overview_template, core_values_template,
    generate_area_of_focus_template_with_refs, generate_goal_template_with_refs,
    generate_project_readme_with_refs, generate_vision_document_template_with_refs,
    generate_weekly_review_habit, goals_overview_template, life_mission_template,
    purpose_principles_overview_template, vision_overview_template, ProjectReadmeParams,
    CABINET_GTD_PRINCIPLES_TEMPLATE, SOMEDAY_LEARN_LANGUAGE_TEMPLATE, WELCOME_TEMPLATE,
};
use super::settings::{get_default_settings, load_settings};

/// Get the default GTD space path for the current user
///
/// Returns a platform-appropriate path in the user's home directory:
/// - macOS/Linux: "$HOME/GTD Space"
/// - Windows: "%USERPROFILE%\\GTD Space"
#[tauri::command]
pub fn get_default_gtd_space_path() -> Result<String, String> {
    fn home_dir() -> Option<PathBuf> {
        if cfg!(target_os = "windows") {
            std::env::var_os("USERPROFILE").map(PathBuf::from)
        } else {
            std::env::var_os("HOME").map(PathBuf::from)
        }
    }

    match home_dir() {
        Some(home) => {
            let default_path = home.join("GTD Space");
            Ok(default_path.to_string_lossy().to_string())
        }
        None => Err("Unable to determine user home directory".to_string()),
    }
}

/// Check whether a path looks like a GTD space.
///
/// A directory is treated as a GTD space when it contains the required
/// `Projects` folder, or when at least three recognized GTD horizon folders
/// are present.
///
/// # Arguments
///
/// * `path` - Full path to validate
///
/// # Returns
///
/// `Ok(true)` when the path matches the GTD directory shape, otherwise `Ok(false)`
#[tauri::command]
pub fn check_is_gtd_space(path: String) -> Result<bool, String> {
    log::info!("Checking if directory is a GTD space: {}", path);
    println!("[check_is_gtd_space] Checking path: {}", path);

    let root_path = Path::new(&path);

    // Check if the path exists and is a directory
    if !root_path.exists() {
        println!("[check_is_gtd_space] Path does not exist: {}", path);
        return Ok(false);
    }

    if !root_path.is_dir() {
        println!("[check_is_gtd_space] Path is not a directory: {}", path);
        return Ok(false);
    }

    // Check for key GTD directories
    // Making Projects the only truly required directory
    let required_dirs = ["Projects"];
    let optional_dirs = [
        "Areas of Focus",
        "Goals",
        "Vision",
        "Purpose & Principles",
        "Habits",
        "Someday Maybe",
        "Cabinet",
    ];

    let mut required_found = 0;
    let mut missing_required = Vec::new();
    for dir in &required_dirs {
        let dir_path = root_path.join(dir);
        if dir_path.exists() && dir_path.is_dir() {
            required_found += 1;
            println!("[check_is_gtd_space] Found required directory: {}", dir);
        } else {
            missing_required.push(dir.to_string());
            println!("[check_is_gtd_space] Missing required directory: {}", dir);
        }
    }

    // Count optional directories
    let mut optional_found = 0;
    for dir in &optional_dirs {
        let dir_path = root_path.join(dir);
        if dir_path.exists() && dir_path.is_dir() {
            optional_found += 1;
            println!("[check_is_gtd_space] Found optional directory: {}", dir);
        }
    }

    // Consider it a GTD space if it has all required directories (Projects),
    // or if it has at least 3 of the GTD directories total
    let is_gtd_space =
        required_found == required_dirs.len() || (required_found + optional_found) >= 3;

    println!(
        "[check_is_gtd_space] Result: {} (required: {}/{}, optional: {}/{}, total: {})",
        if is_gtd_space {
            "IS GTD SPACE"
        } else {
            "NOT GTD SPACE"
        },
        required_found,
        required_dirs.len(),
        optional_found,
        optional_dirs.len(),
        required_found + optional_found
    );

    if !is_gtd_space && !missing_required.is_empty() {
        println!(
            "[check_is_gtd_space] Missing required directories: {:?}",
            missing_required
        );
    }

    log::info!(
        "Directory {} GTD space (required: {}/{}, optional: {}/{})",
        if is_gtd_space { "is a" } else { "is not a" },
        required_found,
        required_dirs.len(),
        optional_found,
        optional_dirs.len()
    );

    Ok(is_gtd_space)
}

#[tauri::command]
pub async fn initialize_gtd_space(space_path: String) -> Result<String, String> {
    log::info!("Initializing GTD space at: {}", space_path);

    let root_path = Path::new(&space_path);

    // Create root directory if it doesn't exist
    if !root_path.exists() {
        if let Err(e) = fs::create_dir_all(root_path) {
            return Err(format!("Failed to create root directory: {}", e));
        }
    }

    // GTD directories to create
    let directories = [
        "Areas of Focus",
        "Goals",
        "Vision",
        "Purpose & Principles",
        "Projects",
        "Habits",
        "Someday Maybe",
        "Cabinet",
    ];

    let mut created_dirs = Vec::new();

    for dir_name in &directories {
        let dir_path = root_path.join(dir_name);

        let preexisted = dir_path.exists();
        match fs::create_dir_all(&dir_path) {
            Ok(_) => {
                if !preexisted {
                    created_dirs.push(dir_name.to_string());
                    log::info!("Created directory: {}", dir_name);
                } else {
                    log::info!("Directory already exists: {}", dir_name);
                }
            }
            Err(e) => {
                if e.kind() == std::io::ErrorKind::AlreadyExists {
                    log::info!("Directory already exists: {}", dir_name);
                } else {
                    return Err(format!("Failed to create {} directory: {}", dir_name, e));
                }
            }
        }

        // Create example files immediately after creating directories
        match *dir_name {
            "Areas of Focus" => {
                // Create overview page
                let overview_file = dir_path.join("README.md");
                if !overview_file.exists() {
                    if let Err(e) = fs::write(&overview_file, areas_of_focus_overview_template()) {
                        log::warn!("Failed to create Areas of Focus overview: {}", e);
                    } else {
                        log::info!("Created Areas of Focus overview");
                    }
                }

                // Create area AFTER we know Goals will exist
                // We'll create the actual area content later after Goals are created
                // For now, just note that this directory exists
            }
            "Goals" => {
                // Create overview page
                let overview_file = dir_path.join("README.md");
                if !overview_file.exists() {
                    if let Err(e) = fs::write(&overview_file, goals_overview_template()) {
                        log::warn!("Failed to create Goals overview: {}", e);
                    } else {
                        log::info!("Created Goals overview");
                    }
                }

                // Create MINIMAL goal with MAXIMUM relationships
                let next_year = chrono::Local::now().year() + 1;
                let space_path_str = root_path.to_string_lossy();
                let vision_base = format!("{}/Vision", space_path_str);
                let purpose_base = format!("{}/Purpose & Principles", space_path_str);

                // Goals reference → Vision AND both Purpose docs
                let vision_ref = format!("{}/My 3-5 Year Vision.md", vision_base);
                let life_mission_ref = format!("{}/Life Mission.md", purpose_base);
                let core_values_ref = format!("{}/Core Values.md", purpose_base);
                let purpose_refs = format!("{},{}", life_mission_ref, core_values_ref);

                // Just ONE goal with ALL possible references
                let goal_name = "Build Financial Freedom";
                let file_path = dir_path.join(format!("{}.md", goal_name));
                if !file_path.exists() {
                    let content = generate_goal_template_with_refs(
                        goal_name,
                        Some(&format!("{}-12-31", next_year)),
                        "Generate $10K/month passive income through multiple revenue streams",
                        &vision_ref,   // References Vision
                        &purpose_refs, // References BOTH Purpose documents
                    );
                    if let Err(e) = fs::write(&file_path, content) {
                        log::warn!("Failed to create goal '{}': {}", goal_name, e);
                    }
                }
            }
            "Vision" => {
                // Create overview page
                let overview_file = dir_path.join("README.md");
                if !overview_file.exists() {
                    if let Err(e) = fs::write(&overview_file, vision_overview_template()) {
                        log::warn!("Failed to create Vision overview: {}", e);
                    } else {
                        log::info!("Created Vision overview");
                    }
                }

                // Create vision document with references to Purpose
                let vision_file = dir_path.join("My 3-5 Year Vision.md");
                if !vision_file.exists() {
                    let space_path_str = root_path.to_string_lossy();
                    let purpose_base = format!("{}/Purpose & Principles", space_path_str);
                    let life_mission_ref = format!("{}/Life Mission.md", purpose_base);
                    let core_values_ref = format!("{}/Core Values.md", purpose_base);
                    let purpose_refs = format!("{},{}", life_mission_ref, core_values_ref);

                    let content = generate_vision_document_template_with_refs(&purpose_refs);
                    if let Err(e) = fs::write(&vision_file, content) {
                        log::warn!("Failed to create vision document: {}", e);
                    } else {
                        log::info!("Created vision document with Purpose references");
                    }
                }
            }
            "Purpose & Principles" => {
                // Create overview page
                let overview_file = dir_path.join("README.md");
                if !overview_file.exists() {
                    if let Err(e) =
                        fs::write(&overview_file, purpose_principles_overview_template())
                    {
                        log::warn!("Failed to create Purpose & Principles overview: {}", e);
                    } else {
                        log::info!("Created Purpose & Principles overview");
                    }
                }

                // Create Life Mission document
                let mission_file = dir_path.join("Life Mission.md");
                if !mission_file.exists() {
                    if let Err(e) = fs::write(&mission_file, life_mission_template()) {
                        log::warn!("Failed to create life mission document: {}", e);
                    } else {
                        log::info!("Created life mission document");
                    }
                }

                // Create Core Values document
                let values_file = dir_path.join("Core Values.md");
                if !values_file.exists() {
                    if let Err(e) = fs::write(&values_file, core_values_template()) {
                        log::warn!("Failed to create core values document: {}", e);
                    } else {
                        log::info!("Created core values document");
                    }
                }
            }
            "Someday Maybe" => {
                let example_file = dir_path.join("Learn a New Language.md");
                if !example_file.exists() {
                    if let Err(e) = fs::write(&example_file, SOMEDAY_LEARN_LANGUAGE_TEMPLATE) {
                        log::warn!("Failed to create example Someday Maybe page: {}", e);
                    } else {
                        log::info!("Created example Someday Maybe page: Learn a New Language.md");
                    }
                }
            }
            "Cabinet" => {
                let example_file = dir_path.join("GTD Principles Reference.md");
                if !example_file.exists() {
                    if let Err(e) = fs::write(&example_file, CABINET_GTD_PRINCIPLES_TEMPLATE) {
                        log::warn!("Failed to create example Cabinet page: {}", e);
                    } else {
                        log::info!("Created example Cabinet page: GTD Principles Reference.md");
                    }
                }
            }
            _ => {}
        }
    }

    // NOW create the Area of Focus with all references (after Goals, Vision, Purpose exist)
    let areas_dir = root_path.join("Areas of Focus");
    if areas_dir.exists() {
        let goals_base = root_path.join("Goals");
        let vision_base = root_path.join("Vision");
        let purpose_base = root_path.join("Purpose & Principles");

        // Build all reference paths
        let goal_ref = format!(
            "{}/Build Financial Freedom.md",
            goals_base.to_string_lossy()
        );
        let vision_ref = format!("{}/My 3-5 Year Vision.md", vision_base.to_string_lossy());
        let life_mission_ref = format!("{}/Life Mission.md", purpose_base.to_string_lossy());
        let core_values_ref = format!("{}/Core Values.md", purpose_base.to_string_lossy());

        // Combine Purpose references
        let purpose_refs = format!("{},{}", life_mission_ref, core_values_ref);

        // Create ONE area with ALL references
        let area_name = "Professional Excellence";
        let area_file = areas_dir.join(format!("{}.md", area_name));
        if !area_file.exists() {
            let content = generate_area_of_focus_template_with_refs(
                area_name,
                "Delivering exceptional value through my work",
                "- Meet all commitments\n- Continuous improvement\n- Build strong relationships",
                &goal_ref,     // References Goal
                &vision_ref,   // References Vision
                &purpose_refs, // References BOTH Purpose docs
            );
            if let Err(e) = fs::write(&area_file, content) {
                log::warn!("Failed to create area '{}': {}", area_name, e);
            } else {
                log::info!("Created area with full references: {}", area_name);
            }
        }
    }

    // Create a welcome file in the root directory
    let welcome_path = root_path.join("Welcome to GTD Space.md");
    if !welcome_path.exists() {
        if let Err(e) = fs::write(&welcome_path, WELCOME_TEMPLATE) {
            log::warn!("Failed to create welcome file: {}", e);
        } else {
            log::info!("Created welcome file");
        }
    }

    let message = if created_dirs.is_empty() {
        "GTD space already initialized".to_string()
    } else {
        format!(
            "GTD space initialized. Created directories: {}",
            created_dirs.join(", ")
        )
    };

    Ok(message)
}

/// Seed the GTD space with example projects and actions
///
/// This creates a small set of demo projects and actions that showcase
/// statuses, focus dates, due dates, and effort levels. If the Projects
/// directory already contains subdirectories, seeding is skipped.
#[tauri::command]
pub async fn seed_example_gtd_content(space_path: String) -> Result<String, String> {
    let projects_root = Path::new(&space_path).join("Projects");

    if !projects_root.exists() {
        return Err("Projects directory does not exist. Initialize GTD space first.".to_string());
    }

    // If a seed marker exists, skip seeding
    let seed_marker = Path::new(&space_path).join(".gtdspace_seeded");
    if seed_marker.exists() {
        return Ok("Example content already seeded".to_string());
    }

    // Detect if any project directories already exist
    let mut has_any_projects = false;
    if let Ok(entries) = fs::read_dir(&projects_root) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                has_any_projects = true;
                break;
            }
        }
    }

    if has_any_projects {
        // Still write a marker so we don't attempt again
        let _ = fs::write(&seed_marker, "seeded: existing-projects");
        return Ok("Projects already exist; skipping example seeding".to_string());
    }

    // Helper to safely create a project and ignore "already exists" errors
    fn ensure_project(
        space_path: &str,
        name: &str,
        description: &str,
        due_date: Option<String>,
        status: Option<String>,
    ) -> Result<String, String> {
        match create_gtd_project(
            space_path.to_string(),
            name.to_string(),
            description.to_string(),
            due_date,
            status,
        ) {
            Ok(path) => Ok(path),
            Err(e) => {
                // If it already exists, compute the expected path and return it
                if e.contains("already exists") {
                    Ok(Path::new(space_path)
                        .join("Projects")
                        .join(name)
                        .to_string_lossy()
                        .to_string())
                } else {
                    Err(e)
                }
            }
        }
    }

    // MINIMAL Project with MAXIMUM references (Project → Area + Goal)
    let next_week = (chrono::Local::now() + chrono::Duration::days(7))
        .with_hour(17)
        .unwrap()
        .with_minute(0)
        .unwrap()
        .with_second(0)
        .unwrap();

    let project_name = "Launch Side Business";
    let project1_path = ensure_project(
        &space_path,
        project_name,
        "Create and launch consulting business for passive income generation",
        Some(next_week.to_rfc3339()),
        Some("in-progress".to_string()),
    )?;

    // Update with references to BOTH Area and Goal
    let areas_ref = format!("{}/Areas of Focus/Professional Excellence.md", &space_path);
    let goals_ref = format!("{}/Goals/Build Financial Freedom.md", &space_path);
    let vision_ref = format!("{}/Vision/My 3-5 Year Vision.md", &space_path);
    let purpose_ref = format!("{}/Purpose & Principles/Core Values.md", &space_path);
    let cabinet_ref = format!("{}/Cabinet/GTD Quick Reference.md", &space_path);

    let readme_path = Path::new(&project1_path).join("README.md");
    let readme_params = ProjectReadmeParams {
        name: project_name,
        description: "Create and launch consulting business for passive income generation",
        due_date: Some(next_week.to_rfc3339()),
        status: "in-progress",
        areas_refs: &areas_ref,     // References Area
        goals_refs: &goals_ref,     // References Goal
        vision_refs: &vision_ref,   // References Vision
        purpose_refs: &purpose_ref, // References Purpose & Principles
        general_refs: &cabinet_ref, // References Cabinet
    };
    let readme_content = generate_project_readme_with_refs(readme_params);
    let _ = fs::write(&readme_path, readme_content);

    // Just 2 simple actions
    let _ = create_gtd_action(
        project1_path.clone(),
        "Define service offerings".to_string(),
        "in-progress".to_string(),
        None,
        Some(chrono::Local::now().to_rfc3339()),
        "medium".to_string(),
        None, // No contexts specified
        None, // No notes for seed action
    );

    let _ = create_gtd_action(
        project1_path.clone(),
        "Create landing page".to_string(),
        "waiting".to_string(),
        Some(next_week.to_rfc3339()),
        None,
        "large".to_string(),
        None, // No contexts specified
        None, // No notes for seed action
    );

    // That's it - just ONE project with maximum connections!

    // Create just ONE example habit
    let habits_dir = Path::new(&space_path).join("Habits");
    if habits_dir.exists() {
        let weekly_review = habits_dir.join("Weekly GTD Review.md");
        if !weekly_review.exists() {
            let content = generate_weekly_review_habit();
            let _ = fs::write(&weekly_review, content);
        }
    }

    // Create just ONE Someday Maybe example
    let someday_dir = Path::new(&space_path).join("Someday Maybe");
    if someday_dir.exists() {
        let someday_example = someday_dir.join("Write a Book.md");
        if !someday_example.exists() {
            let content = r#"# Write a Book

**Topic**: Practical guide to building sustainable business systems

## When I'm ready:
- [ ] Outline key chapters
- [ ] Research publishers vs self-publishing
- [ ] Build audience platform first
- [ ] Dedicate 2 hours daily to writing

*Will support my Financial Freedom goal when activated*
"#;
            let _ = fs::write(&someday_example, content);
        }
    }

    // Create just ONE Cabinet reference (that the project references)
    let cabinet_dir = Path::new(&space_path).join("Cabinet");
    if cabinet_dir.exists() {
        // Only create the GTD Quick Reference that our project references
        let gtd_ref = cabinet_dir.join("GTD Quick Reference.md");
        if !gtd_ref.exists() {
            // Using the existing CABINET_GTD_PRINCIPLES_TEMPLATE
            if let Err(e) = fs::write(&gtd_ref, CABINET_GTD_PRINCIPLES_TEMPLATE) {
                log::warn!("Failed to create GTD Quick Reference: {}", e);
            }
        }
    }

    // Note: Horizons are now created as top-level folders during initialization
    // No need to recreate them here

    // Habits already created above - removed duplicates

    // Write seed marker
    let _ = fs::write(
        &seed_marker,
        format!("seeded: {}", chrono::Local::now().to_rfc3339()),
    );

    Ok("Seeded example projects, actions, horizons, habits, and reference materials".to_string())
}

/// Initialize default GTD space and optionally seed example content in one call
#[tauri::command]
pub async fn initialize_default_gtd_space(app: AppHandle) -> Result<String, String> {
    // Load settings to determine behavior
    let settings = load_settings(app.clone())
        .await
        .unwrap_or_else(|_| get_default_settings());

    // Resolve default path (settings override or platform default)
    let target_path = if let Some(path) = settings.default_space_path.clone() {
        path
    } else {
        get_default_gtd_space_path()?
    };

    // Ensure GTD structure
    let _ = initialize_gtd_space(target_path.clone()).await?;

    // Seed content if enabled
    if settings.seed_example_content.unwrap_or(true) {
        let _ = seed_example_gtd_content(target_path.clone()).await;
    }

    Ok(target_path)
}
