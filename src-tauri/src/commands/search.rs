//! Search commands and payload types.

use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tokio::task;
use walkdir::WalkDir;

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

fn byte_offset_to_utf16(text: &str, byte_offset: usize) -> usize {
    text[..byte_offset].encode_utf16().count()
}

fn match_range_to_utf16(text: &str, range: (usize, usize)) -> (usize, usize) {
    (
        byte_offset_to_utf16(text, range.0),
        byte_offset_to_utf16(text, range.1),
    )
}

fn truncated_response(
    start_time: std::time::Instant,
    results: Vec<SearchResult>,
    total_matches: usize,
    files_searched: usize,
) -> SearchResponse {
    let duration = start_time.elapsed().as_millis() as u64;
    log::info!(
        "Search completed with {} results in {}ms (truncated)",
        results.len(),
        duration
    );
    SearchResponse {
        results,
        total_matches,
        files_searched,
        duration_ms: duration,
        truncated: true,
    }
}

#[tauri::command]
pub async fn search_files(
    query: String,
    directory: String,
    filters: SearchFilters,
) -> Result<SearchResponse, String> {
    let start_time = std::time::Instant::now();
    let max_results = filters.max_results.max(1);
    let filters = SearchFilters {
        max_results,
        ..filters
    };

    log::debug!(
        "Starting search (query_len={}, use_regex={}, case_sensitive={}, whole_word={}, include_file_names={}, max_results={})",
        query.chars().count(),
        filters.use_regex,
        filters.case_sensitive,
        filters.whole_word,
        filters.include_file_names,
        filters.max_results
    );

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

    task::spawn_blocking(move || {
        let mut results = Vec::new();
        let mut files_searched = 0;
        let mut total_matches = 0;
        let markdown_extensions = ["md", "markdown"];

        let regex_pattern = if filters.use_regex {
            match RegexBuilder::new(&query)
                .case_insensitive(!filters.case_sensitive)
                .build()
            {
                Ok(re) => Some(re),
                Err(e) => return Err(format!("Invalid regex pattern: {}", e)),
            }
        } else {
            None
        };

        let plain_text_matcher = if filters.use_regex {
            None
        } else {
            let pattern = if filters.whole_word {
                format!(r"\b{}\b", regex::escape(&query))
            } else {
                regex::escape(&query)
            };

            match RegexBuilder::new(&pattern)
                .case_insensitive(!filters.case_sensitive)
                .build()
            {
                Ok(re) => Some(re),
                Err(e) => return Err(format!("Invalid search pattern: {}", e)),
            }
        };

        for entry in WalkDir::new(&directory)
            .into_iter()
            .filter_map(|entry| match entry {
                Ok(entry) => Some(entry),
                Err(error) => {
                    log::warn!("Skipping unreadable search entry: {}", error);
                    None
                }
            })
        {
            let path = entry.path();

            if path.is_file() {
                if let Some(extension) = path.extension() {
                    let ext_str = extension.to_string_lossy().to_lowercase();
                    if markdown_extensions.contains(&ext_str.as_str()) {
                        files_searched += 1;

                        if let Ok(content) = fs::read_to_string(path) {
                            let file_name = path
                                .file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .to_string();
                            let file_path = path.to_string_lossy().to_string();

                            if filters.include_file_names {
                                for match_result in search_in_text(
                                    &file_name,
                                    &filters,
                                    &regex_pattern,
                                    &plain_text_matcher,
                                ) {
                                    let prefix = "📁 ";
                                    let prefix_utf16_len = prefix.encode_utf16().count();
                                    let (match_start, match_end) =
                                        match_range_to_utf16(&file_name, match_result);
                                    total_matches += 1;

                                    if results.len() >= filters.max_results {
                                        return Ok(truncated_response(
                                            start_time,
                                            results,
                                            total_matches,
                                            files_searched,
                                        ));
                                    }

                                    results.push(SearchResult {
                                        file_path: file_path.clone(),
                                        file_name: file_name.clone(),
                                        line_number: 0,
                                        line_content: format!("{}{}", prefix, file_name),
                                        match_start: prefix_utf16_len + match_start,
                                        match_end: prefix_utf16_len + match_end,
                                        context_before: None,
                                        context_after: None,
                                    });
                                }
                            }

                            let lines: Vec<&str> = content.lines().collect();
                            for (line_number, line) in lines.iter().enumerate() {
                                for match_result in search_in_text(
                                    line,
                                    &filters,
                                    &regex_pattern,
                                    &plain_text_matcher,
                                ) {
                                    let (match_start, match_end) =
                                        match_range_to_utf16(line, match_result);
                                    total_matches += 1;

                                    if results.len() >= filters.max_results {
                                        return Ok(truncated_response(
                                            start_time,
                                            results,
                                            total_matches,
                                            files_searched,
                                        ));
                                    }

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
                                        match_start,
                                        match_end,
                                        context_before,
                                        context_after,
                                    });
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
    })
    .await
    .map_err(|error| format!("Search task failed: {}", error))?
}

/// Search for a pattern in text with various options
fn search_in_text(
    text: &str,
    filters: &SearchFilters,
    regex_pattern: &Option<Regex>,
    plain_text_matcher: &Option<Regex>,
) -> Vec<(usize, usize)> {
    let matcher = if filters.use_regex {
        regex_pattern.as_ref()
    } else {
        plain_text_matcher.as_ref()
    };

    matcher
        .map(|re| {
            re.find_iter(text)
                .map(|mat| (mat.start(), mat.end()))
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn build_filters(use_regex: bool) -> SearchFilters {
        SearchFilters {
            case_sensitive: true,
            whole_word: false,
            use_regex,
            include_file_names: false,
            max_results: 10,
        }
    }

    #[test]
    fn search_in_text_returns_all_plain_text_matches() {
        let filters = build_filters(false);
        let matcher = RegexBuilder::new(&regex::escape("test"))
            .build()
            .expect("plain text regex should compile");

        let matches = search_in_text("test and test again", &filters, &None, &Some(matcher));

        assert_eq!(matches, vec![(0, 4), (9, 13)]);
    }

    #[test]
    fn search_in_text_returns_all_regex_matches() {
        let filters = build_filters(true);
        let regex = RegexBuilder::new(r"t\w{3}")
            .build()
            .expect("regex should compile");

        let matches = search_in_text("test text tent", &filters, &Some(regex), &None);

        assert_eq!(matches, vec![(0, 4), (5, 9), (10, 14)]);
    }
}
