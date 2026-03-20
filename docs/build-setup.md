# Build Setup Guide

This document covers the build-specific expectations for GTD Space. For first-time environment setup, start with [`installation.md`](./installation.md).

## Core Build Commands

The current package scripts are:

- `npm run dev`: frontend-only Vite development server
- `npm run tauri:dev`: full desktop development environment
- `npm run build`: TypeScript check plus production frontend build
- `npm run tauri:build`: desktop bundle build
- `npm run icons:generate`: regenerate app icons used by packaged builds

## Packaging Expectations

The packaged desktop build depends on:

- a successful frontend build
- the Tauri bundle configuration in `src-tauri/tauri.conf.json`
- generated icon assets
- platform-specific native build prerequisites described in [`installation.md`](./installation.md)

`npm run tauri:build` automatically runs icon generation first through the `pretauri:build` script.

## Icons

The Tauri bundle currently expects these icon assets:

- `src-tauri/icons/32x32.png`
- `src-tauri/icons/128x128.png`
- `src-tauri/icons/128x128@2x.png`
- `src-tauri/icons/icon.icns`
- `src-tauri/icons/icon.ico`

Use [`icon-generation.md`](./icon-generation.md) for icon-specific details.

## Quality Gates

Before building a release candidate, run:

- `npm run lint`
- `npm run type-check`
- `npm run test:run`
- `npm run tauri:dev` for a quick manual smoke test when UI behavior changed

## Related Docs

- [`installation.md`](./installation.md)
- [`icon-generation.md`](./icon-generation.md)
- [`release-process.md`](./release-process.md)
