# Icon Generation Guide

This document covers the app icon assets required for packaged Tauri builds.

## Current Workflow

Use the project script:

```bash
npm run icons:generate
```

That script is also run automatically before `npm run tauri:build`.

## Required Bundle Assets

The current Tauri config expects:

- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns`
- `icon.ico`

These live under `src-tauri/icons/`.

## When To Regenerate Icons

Regenerate icons when:

- the app logo changes
- packaged builds fail because a required icon asset is missing
- a platform-specific bundle looks incorrect

## Related Docs

- [`build-setup.md`](./build-setup.md)
- [`release-process.md`](./release-process.md)
