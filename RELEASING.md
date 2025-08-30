# Quick Release Guide

## 🚀 Creating a New Release

### Fastest Method (Patch Release)

```bash
npm run release
```

This command will:

1. Bump the patch version
2. Create a git commit and tag locally
3. Automatically push changes and tags to GitHub
4. GitHub Actions will then trigger builds for all platforms

### Other Version Types

```bash
npm run release:minor  # 0.1.0 → 0.2.0 (auto-push)
npm run release:major  # 0.1.0 → 1.0.0 (auto-push)
npm run release:patch  # 0.1.0 → 0.1.1 (auto-push)

# Or manually bump version only (no auto-push):
npm run version:minor  # Then manually: git push && git push --tags
npm run version:major  # Then manually: git push && git push --tags
npm run version:patch  # Then manually: git push && git push --tags
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
