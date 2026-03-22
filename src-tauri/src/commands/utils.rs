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

    if sanitized.is_empty() {
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
}
