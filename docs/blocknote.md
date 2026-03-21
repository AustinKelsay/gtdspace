# BlockNote Integration

GTD Space uses BlockNote as its primary rich-text editor. The editor is not a generic markdown wrapper; it is extended with GTD-specific blocks, a markdown-to-block post-processing pipeline, and custom save/load behavior.

## Current Editor Stack

The main editor components are:

- `EnhancedTextEditor`
- `BlockNoteEditor`
- custom editor blocks under `src/components/editor/blocks/`
- preprocessing utilities under `src/utils/blocknote-preprocessing/`

These sit on top of markdown files stored on disk. The editor does not replace the file-based model; it provides a richer editing surface over it.

## Custom GTD Blocks

The current custom block set includes:

- single-select blocks
- multi-select blocks
- date/time blocks
- references blocks
- horizon references blocks
- actions list blocks
- habits list blocks
- horizon list blocks
- checkbox blocks

These blocks exist because GTD Space stores structured meaning inside markdown markers and rendered list blocks.

## Markdown Pipeline

The important runtime path is:

1. read markdown from disk
2. parse markdown into BlockNote blocks
3. post-process parsed blocks so GTD markers and legacy HTML become custom blocks
4. let the user edit in the rich editor
5. serialize BlockNote blocks back into canonical GTD markers plus standard markdown
6. save through the file manager

For canonical marker rules and document ordering, use the spec rather than this file.

The preprocessing folder is split by concern rather than by block family:

- markdown and legacy HTML scanning
- paragraph replacement and custom block creation
- history-section bypass/filter rules
- cache and hashing helpers

That keeps the runtime entry point small while making the conversion rules easier to test directly.

## Practical Constraints

There are a few important limitations:

- conversion back to markdown is lossy in some cases
- preview/source modes are not the main production editing path
- some custom GTD semantics depend on preprocessing and postprocessing rather than on BlockNote alone

## Styling

Editor styling is spread across:

- `src/components/editor/blocknote-theme.css`
- theme variables in the global styling system
- the custom block components themselves

If you are changing the editor visually, read [`theming.md`](./theming.md) alongside the editor source.

## Related Docs

- [`markdown.md`](./markdown.md)
- [`theming.md`](./theming.md)
- [`../spec/02-markdown-schema.md`](../spec/02-markdown-schema.md)
