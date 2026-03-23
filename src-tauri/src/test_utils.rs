use std::fs;
use std::path::Path;

use tempfile::TempDir;

pub fn write_test_file(path: impl AsRef<Path>, content: &str) -> Result<(), String> {
    let path = path.as_ref();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create test directory: {}", error))?;
    }
    fs::write(path, content).map_err(|error| format!("Failed to write test file: {}", error))
}

pub fn seed_test_workspace() -> Result<TempDir, String> {
    let temp_dir = tempfile::tempdir().map_err(|error| error.to_string())?;
    let root = temp_dir.path();

    for folder in ["Projects", "Habits", "Cabinet", "Someday Maybe", "Goals"] {
        fs::create_dir_all(root.join(folder))
            .map_err(|error| format!("Failed to create workspace folder: {}", error))?;
    }

    write_test_file(
        root.join("Goals/Fitness.md"),
        r#"# Fitness

[!singleselect:status:active]
[!datetime:created_date_time:2026-03-20T09:00:00Z]

## Description

Build a sustainable training habit.
"#,
    )?;

    write_test_file(
        root.join("Projects/Alpha Project/README.md"),
        r#"# Alpha Project

[!singleselect:project-status:in-progress]
[!datetime:due_date:2026-04-01]
[!datetime:created_date_time:2026-03-20T10:00:00Z]
[!multiselect:goal_refs:Goals/Fitness.md]

## Desired Outcome

Ship the Alpha project cleanly.
"#,
    )?;

    Ok(temp_dir)
}
