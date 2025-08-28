# Quick Release Guide

## 🚀 Creating a New Release

### Fastest Method (Patch Release)

```bash
npm run release
```

This command will:

1. Bump the patch version
2. Create a git commit and tag locally
3. **Manual step**: Push changes and tags to GitHub with:
   ```bash
   git push && git push --tags
   ```
4. GitHub Actions will then trigger builds for all platforms

### Other Version Types

```bash
npm run version:minor  # 0.1.0 → 0.2.0
npm run version:major  # 0.1.0 → 1.0.0
npm run version:patch  # 0.1.0 → 0.1.1

# Then push
git push && git push --tags
```

## 📦 What Happens Next?

After pushing a tag, GitHub Actions automatically:

1. Builds for Windows, macOS (Intel & Apple Silicon), and Linux
2. Creates a draft GitHub Release with all installers; you must publish it manually in the GitHub UI when ready

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
