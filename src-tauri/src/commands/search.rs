//! Search commands and payload types.

use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

/// Search result item
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    /// File path where match was found
    pub file_path: String,
    /// File name without path
    pub file_name: String,
    /// Line number (0-based)
    pub line_number: usize,
    /// Line content containing the match
    pub line_content: String,
    /// Start position of match within the line
    pub match_start: usize,
    /// End position of match within the line
    pub match_end: usize,
    /// Context lines before the match
    pub context_before: Option<Vec<String>>,
    /// Context lines after the match
    pub context_after: Option<Vec<String>>,
}

/// Search filters and options
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchFilters {
    /// Case sensitive search
    pub case_sensitive: bool,
    /// Whole word matching
    pub whole_word: bool,
    /// Use regular expressions
    pub use_regex: bool,
    /// Include file names in search
    pub include_file_names: bool,
    /// Maximum number of results
    pub max_results: usize,
}

/// Search response from backend
#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResponse {
    /// Search results
    pub results: Vec<SearchResult>,
    /// Total number of matches found
    pub total_matches: usize,
    /// Number of files searched
    pub files_searched: usize,
    /// Search duration in milliseconds
    pub duration_ms: u64,
    /// Whether search was truncated due to limits
    pub truncated: bool,
}

#[tauri::command]
pub async fn search_files(
    query: String,
    directory: String,
    filters: SearchFilters,
) -> Result<SearchResponse, String> {
    let start_time = std::time::Instant::now();

    log::info!("Searching for '{}' in directory: {}", query, directory);

    let dir_path = Path::new(&directory);
    if !dir_path.exists() || !dir_path.is_dir() {
        return Err("Directory does not exist or is not a directory".to_string());
    }

    if query.trim().is_empty() {
        return Ok(SearchResponse {
            results: vec![],
            total_matches: 0,
            files_searched: 0,
            duration_ms: start_time.elapsed().as_millis() as u64,
            truncated: false,
        });
    }

    let mut results = Vec::new();
    let mut files_searched = 0;
    let mut total_matches = 0;
    let markdown_extensions = ["md", "markdown"];

    // Prepare regex if needed
    let regex_pattern = if filters.use_regex {
        match Regex::new(&query) {
            Ok(re) => Some(re),
            Err(e) => return Err(format!("Invalid regex pattern: {}", e)),
        }
    } else {
        None
    };

    // Search through all markdown files
    if let Ok(entries) = fs::read_dir(dir_path) {
        for entry in entries.flatten() {
            let path = entry.path();

            if path.is_file() {
                if let Some(extension) = path.extension() {
                    let ext_str = extension.to_string_lossy().to_lowercase();
                    if markdown_extensions.contains(&ext_str.as_str()) {
                        files_searched += 1;

                        if let Ok(content) = fs::read_to_string(&path) {
                            let file_name = path
                                .file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .to_string();
                            let file_path = path.to_string_lossy().to_string();

                            // Search in file name if enabled
                            if filters.include_file_names {
                                if let Some(match_result) =
                                    search_in_text(&file_name, &query, &filters, &regex_pattern)
                                {
                                    results.push(SearchResult {
                                        file_path: file_path.clone(),
                                        file_name: file_name.clone(),
                                        line_number: 0,
                                        line_content: format!("📁 {}", file_name),
                                        match_start: match_result.0,
                                        match_end: match_result.1,
                                        context_before: None,
                                        context_after: None,
                                    });
                                    total_matches += 1;
                                }
                            }

                            // Search in file content
                            let lines: Vec<&str> = content.lines().collect();
                            for (line_number, line) in lines.iter().enumerate() {
                                if let Some(match_result) =
                                    search_in_text(line, &query, &filters, &regex_pattern)
                                {
                                    let context_before = if line_number > 0 {
                                        Some(
                                            lines
                                                .get(line_number.saturating_sub(2)..line_number)
                                                .unwrap_or(&[])
                                                .iter()
                                                .map(|s| s.to_string())
                                                .collect(),
                                        )
                                    } else {
                                        None
                                    };

                                    let context_after = if line_number < lines.len() - 1 {
                                        Some(
                                            lines
                                                .get(
                                                    line_number + 1
                                                        ..std::cmp::min(
                                                            line_number + 3,
                                                            lines.len(),
                                                        ),
                                                )
                                                .unwrap_or(&[])
                                                .iter()
                                                .map(|s| s.to_string())
                                                .collect(),
                                        )
                                    } else {
                                        None
                                    };

                                    results.push(SearchResult {
                                        file_path: file_path.clone(),
                                        file_name: file_name.clone(),
                                        line_number,
                                        line_content: line.to_string(),
                                        match_start: match_result.0,
                                        match_end: match_result.1,
                                        context_before,
                                        context_after,
                                    });
                                    total_matches += 1;

                                    // Check max results limit
                                    if results.len() >= filters.max_results {
                                        let duration = start_time.elapsed().as_millis() as u64;
                                        log::info!(
                                            "Search completed with {} results in {}ms (truncated)",
                                            results.len(),
                                            duration
                                        );
                                        return Ok(SearchResponse {
                                            results,
                                            total_matches,
                                            files_searched,
                                            duration_ms: duration,
                                            truncated: true,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let duration = start_time.elapsed().as_millis() as u64;
    log::info!(
        "Search completed with {} results in {}ms",
        results.len(),
        duration
    );

    Ok(SearchResponse {
        results,
        total_matches,
        files_searched,
        duration_ms: duration,
        truncated: false,
    })
}

/// Search for a pattern in text with various options
fn search_in_text(
    text: &str,
    query: &str,
    filters: &SearchFilters,
    regex_pattern: &Option<Regex>,
) -> Option<(usize, usize)> {
    if filters.use_regex {
        if let Some(re) = regex_pattern {
            if let Some(mat) = re.find(text) {
                return Some((mat.start(), mat.end()));
            }
        }
        return None;
    }

    let pattern = if filters.whole_word {
        format!(r"\b{}\b", regex::escape(query))
    } else {
        regex::escape(query)
    };

    let matcher = RegexBuilder::new(&pattern)
        .case_insensitive(!filters.case_sensitive)
        .build()
        .ok()?;

    matcher.find(text).map(|mat| (mat.start(), mat.end()))
}
