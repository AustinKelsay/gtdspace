# Release Notes

Each shipped version should have a checked-in release notes file in this directory.

## Naming

- Preferred: `vX.Y.Z.md`
- Also supported by the helper script: `X.Y.Z.md`

The release workflows and `npm run release:*` scripts look up release notes by the exact version being released. If the matching file is missing, the release fails before tagging or publishing.

## Local Preview

Render the notes for a specific release with:

```bash
npm run release:notes -- v2.0.0
```

Or write the rendered body to a file:

```bash
npm run release:notes -- v2.0.0 --output /tmp/gtdspace-release-notes.md
```

## Template

Start from [`TEMPLATE.md`](./TEMPLATE.md), then save the final notes under the exact release version filename.
