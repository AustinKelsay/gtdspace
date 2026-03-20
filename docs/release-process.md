# Release Process

This is the canonical release guide for GTD Space.

## Recommended Flow

Use the scripted release commands from `package.json`:

- `npm run release`
- `npm run release:minor`
- `npm run release:major`

These scripts perform the version bump, create the release commit and tag, and push the result.

## Before Releasing

Run the normal quality checks:

- `npm run lint`
- `npm run type-check`
- `npm run test:run`
- `npm run tauri:dev` when UI or GTD behavior changed materially

If your team flow still uses `staging` for integration testing, complete that merge path before tagging a release from `main`.

## What The Release Scripts Update

The release/version scripts coordinate version updates across the packaging surface, including:

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

## GitHub Actions

The release pipeline is tag-driven:

- version scripts create a `v*` tag
- pushing that tag triggers the release workflow
- GitHub Actions builds the platform artifacts and publishes the release assets
- Manual workflow dispatch is available on `main` or `staging` when you supply an explicit version input

Use the GitHub Actions tab to monitor progress and diagnose failures.

## If You Need Manual Control

The lower-level version scripts are:

- `npm run version:patch`
- `npm run version:minor`
- `npm run version:major`

These create the local version bump commit and tag without performing the higher-level release workflow.

## Related Docs

- [`../RELEASING.md`](../RELEASING.md)
- [`build-setup.md`](./build-setup.md)
- [`mac-signing-setup.md`](./mac-signing-setup.md)
