// Compatibility shim retained for older callers. The live editor path no longer
// uses this helper, so it only validates legacy multiselect HTML and replaces
// it with placeholder tokens such as {{MULTISELECT_...}}.
//
// These placeholders are intentionally not reversible: this shim does not keep
// any restoration metadata. New code should prefer `postProcessBlockNoteBlocks`,
// which performs the full conversion flow and preserves reversible metadata.
export function preprocessMarkdownForBlockNote(
  markdown: string,
  placeholderMap?: Record<string, string>
): string {
  // This legacy export is currently kept for compatibility with older call sites.
  // The active editor path uses postProcessBlockNoteBlocks after markdown parsing.
  const multiSelectHTMLPattern =
    /<div\s+data-multiselect='([^']+)'\s+class="multiselect-block">([^<]+)<\/div>/g;

  let processedMarkdown = markdown;
  let match: RegExpExecArray | null;

  while ((match = multiSelectHTMLPattern.exec(markdown)) !== null) {
    try {
      // Validation only: the parsed value is intentionally discarded, and malformed
      // legacy payloads fall through to the catch block below.
      JSON.parse(match[1]);
      const placeholder = `{{MULTISELECT_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 11)}}}`;
      if (placeholderMap) {
        placeholderMap[placeholder] = match[0];
      }
      processedMarkdown = processedMarkdown.replace(match[0], placeholder);
    } catch (error) {
      console.error("Error parsing multiselect HTML:", error);
    }
  }

  return processedMarkdown;
}
