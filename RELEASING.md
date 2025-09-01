# Quick Release Guide

## 🚀 Creating a New Release

### Fastest Method (Patch Release)

```bash
npm run release
```

This command will automatically:

1. Bump the patch version
2. Create a git commit and tag
3. Push the commit and tag to GitHub
4. Trigger the GitHub Actions build and release process

### Other Version Types

These commands automatically bump the version, create a commit and tag, and push to the remote:

```bash
npm run release:minor  # 0.1.0 → 0.2.0
npm run release:major  # 0.1.0 → 1.0.0
npm run release:patch  # 0.1.0 → 0.1.1
```

Alternatively, to only bump the version and create a local commit and tag without automatically pushing, use the `version:*` commands. You will need to push manually afterward.

```bash
# Bump version, create local commit and tag only (no auto-push):
npm run version:minor
npm run version:major
npm run version:patch

# Then, push the changes manually:
git push --follow-tags
```

## 📦 What Happens Next?

After pushing a tag, GitHub Actions automatically:

1. Builds for Windows, macOS (Intel & Apple Silicon), and Linux
2. Releases are published automatically by the CI via the `finalize-release` job in `.github/workflows/build.yml`.
3. The VERSION environment variable is automatically set from the git tag - no manual configuration needed

Monitor progress: [GitHub Actions](https://github.com/AustinKelsay/gtdspace/actions)

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
