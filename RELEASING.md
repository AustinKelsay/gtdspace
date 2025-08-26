# Quick Release Guide

## 🚀 Creating a New Release

### Fastest Method (Patch Release)
```bash
npm run release
```
This command will:
1. Bump the patch version
2. Create a git commit and tag
3. Push everything to GitHub
4. Trigger automatic builds for all platforms

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
2. Creates a GitHub Release with all installers
3. Publishes the release when ready

Monitor progress: [GitHub Actions](../../actions)

## 📋 Pre-Release Checklist

- [ ] Run `npm run type-check`
- [ ] Run `npm run lint`
- [ ] Test locally with `npm run tauri:dev`
- [ ] All changes merged to `main`

## 📚 Detailed Documentation

For complete release process documentation, see [docs/release-process.md](docs/release-process.md)