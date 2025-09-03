# Quick Release Guide

## 🚀 Creating a New Release

### Fully Automated Release (Recommended)

The `npm run release` command (and its `:minor`, `:major` variants) is the recommended method.

```bash
# For a patch release (e.g., 0.1.0 → 0.1.1)
npm run release

# Or for other types:
npm run release:minor
npm run release:major
```

This command automates the entire process:
1.  Runs pre-flight checks (clean git status, up-to-date branch, tests, linting).
2.  Bumps the version in `package.json`, `Cargo.toml`, and `tauri.conf.json`.
3.  Creates a Git commit and a version tag (e.g., `v0.1.1`).
4.  **Pushes the commit and tag to the remote `origin` repository.**
5.  This push automatically triggers the GitHub Actions release workflow.

### Semi-Automated Release (Manual Push)

If you prefer to push manually, use the `version:*` scripts. These perform the version bump and create a local commit and tag, but do **not** push to the remote.

```bash
# Bump version and create local commit/tag:
npm run version:patch
npm run version:minor
npm run version:major

# Then, push manually to trigger the release workflow:
git push --follow-tags
```

## 📦 What Happens Next? The CI/CD Pipeline

Pushing a tag matching `v*` (e.g., `v1.2.3`) triggers the `build.yml` workflow in GitHub Actions, which handles the rest of the release process:

1.  **Create Draft Release**: A draft release is created on GitHub using the tag. This is done by the `actions/create-release` action with `draft: true`.
2.  **Build Artifacts**: The application is built in parallel for all target platforms (Windows, macOS x64/aarch64, Linux).
3.  **Publish and Upload**: Once all builds are successful, the `finalize-release` job runs. It uses `softprops/action-gh-release@v2` to:
    *   Publish the draft release (by setting `draft: false`).
    *   Upload all the compiled application installers and bundles (e.g., `.msi`, `.dmg`, `.AppImage`) to the release page.

You can monitor the progress in the [GitHub Actions tab](https://github.com/AustinKelsay/gtdspace/actions).

## 📋 Pre-Release Checklist

- [ ] Run `npm run type-check`
- [ ] Run `npm run lint`
- [ ] Test locally with `npm run tauri:dev`
- [ ] All feature/fix branches merged to `staging` for integration testing
- [ ] After testing in staging, merge to `main`
- [ ] Create and push a release tag after merging to main:
  ```bash
  git tag vX.Y.Z
  git push origin vX.Y.Z
  ```
  **Note:** Only pushing a tag matching `v*` will trigger the build/publish release workflow

## 📚 Detailed Documentation

For complete release process documentation, see [docs/release-process.md](docs/release-process.md)