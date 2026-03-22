pub fn sanitize_markdown_file_stem(name: &str) -> String {
    let sanitized = name
        .trim()
        .trim_end_matches(".md")
        .trim_end_matches(".markdown")
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
