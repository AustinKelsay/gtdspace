fn strip_markdown_suffixes(value: &str) -> String {
    let mut stripped = value.trim().to_string();

    loop {
        let lowered = stripped.to_ascii_lowercase();
        if lowered.ends_with(".markdown") {
            let next_len = stripped.len().saturating_sub(".markdown".len());
            stripped.truncate(next_len);
            continue;
        }
        if lowered.ends_with(".md") {
            let next_len = stripped.len().saturating_sub(".md".len());
            stripped.truncate(next_len);
            continue;
        }
        break;
    }

    stripped
}

pub fn sanitize_markdown_file_stem(name: &str) -> String {
    let sanitized = strip_markdown_suffixes(name)
        .chars()
        .map(|ch| match ch {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            _ => ch,
        })
        .collect::<String>()
        .trim()
        .trim_matches('.')
        .to_string();

    let reserved_check = sanitized
        .split('.')
        .next()
        .unwrap_or(&sanitized)
        .to_ascii_uppercase();
    let is_reserved_windows_name = matches!(
        reserved_check.as_str(),
        "CON"
            | "PRN"
            | "AUX"
            | "NUL"
            | "COM1"
            | "COM2"
            | "COM3"
            | "COM4"
            | "COM5"
            | "COM6"
            | "COM7"
            | "COM8"
            | "COM9"
            | "LPT1"
            | "LPT2"
            | "LPT3"
            | "LPT4"
            | "LPT5"
            | "LPT6"
            | "LPT7"
            | "LPT8"
            | "LPT9"
    );

    if sanitized.is_empty() || is_reserved_windows_name {
        "untitled".to_string()
    } else {
        sanitized
    }
}

#[cfg(test)]
mod tests {
    use super::sanitize_markdown_file_stem;

    #[test]
    fn strips_markdown_suffixes_case_insensitively() {
        assert_eq!(sanitize_markdown_file_stem("Task.MD"), "Task");
        assert_eq!(sanitize_markdown_file_stem("Task.md.markdown"), "Task");
        assert_eq!(sanitize_markdown_file_stem("Task.Md"), "Task");
    }

    #[test]
    fn strips_forbidden_chars() {
        assert_eq!(sanitize_markdown_file_stem("File:Name?.md"), "File-Name-");
    }

    #[test]
    fn returns_untitled_for_empty_input() {
        assert_eq!(sanitize_markdown_file_stem(""), "untitled");
        assert_eq!(sanitize_markdown_file_stem("   "), "untitled");
    }

    #[test]
    fn trims_leading_trailing_dots() {
        assert_eq!(sanitize_markdown_file_stem("...Task..."), "Task");
    }

    #[test]
    fn rejects_reserved_windows_device_names() {
        assert_eq!(sanitize_markdown_file_stem("CON"), "untitled");
        assert_eq!(sanitize_markdown_file_stem("lpt1.md"), "untitled");
    }
}
