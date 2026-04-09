# Release Process

This is the canonical release guide for GTD Space.

## Recommended Flow

Use the scripted release commands from `package.json`:

- `npm run release`
- `npm run release:minor`
- `npm run release:major`

These scripts run the release checks, validate the matching release notes file, create the release commit and tag, and push the result.
They now also run the dedicated release-path end-to-end suite via `npm run test:release:e2e`.

## Before Releasing

Run the normal quality checks:

- `npm run lint`
- `npm run type-check`
- `npm run test:run`
- `npm run test:release:e2e`
- `cd src-tauri && cargo test --bins --tests`
- `npm run tauri:dev` when UI or GTD behavior changed materially

If your team flow still uses `staging` for integration testing, complete that merge path before tagging a release from `main`.

Before starting a release, add the curated release notes file for the exact target version:

- `docs/releases/vX.Y.Z.md`

You can preview the rendered release body with:

- `npm run release:notes -- vX.Y.Z`
- `npm run release:notes -- vX.Y.Z --output /tmp/gtdspace-release-notes.md`

## What The Release Scripts Update

The release/version scripts coordinate version updates across the packaging surface, including:

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

## GitHub Actions

The release pipeline is tag-driven:

- version scripts create a `v*` tag
- pushing that tag triggers the release workflow
- GitHub Actions renders the checked-in release notes, builds the platform artifacts, and publishes the release assets
- Manual workflow dispatch is available on `main` or `staging` when you supply an explicit version input

Use the GitHub Actions tab to monitor progress and diagnose failures.

## Dry Runs

You can verify the entire scripted flow without mutating the repo:

- `npm run release:major -- --dry-run`

Dry runs execute the same preflight checks and release-notes validation, then stop before any version file, commit, tag, or push is created.

## If You Need Manual Control

The lower-level version scripts are:

- `npm run version:patch`
- `npm run version:minor`
- `npm run version:major`

These create the local version bump commit and tag without performing the higher-level release workflow.

## Related Docs

- [`../RELEASING.md`](../RELEASING.md)
- [`releases/README.md`](./releases/README.md)
- [`build-setup.md`](./build-setup.md)
- [`mac-signing-setup.md`](./mac-signing-setup.md)
