# Release Process

This document outlines the process for creating and publishing new releases of GTD Space.

## Overview

GTD Space uses GitHub Actions to automate the build and release process. When you push a version tag prefixed with "v" (e.g., v1.2.3) to GitHub, the CI/CD pipeline automatically:

1. Builds the application for all platforms (Windows, macOS Intel, macOS Apple Silicon, Linux)
2. Creates a GitHub Release with all artifacts
3. Publishes the release with download links

## Prerequisites

Before creating a release:

1. Ensure all changes are merged to `main` branch
2. Run tests locally to verify everything works:
   ```bash
   npm run type-check
   npm run lint
   npm run tauri:build  # Test local build
   ```
3. Update the CHANGELOG (if you maintain one)
4. Ensure you have Git configured for signing commits (optional but recommended)

## Creating a Release

### Method 1: Using Automated Scripts (Recommended)

We provide two sets of scripts for releases: fully automated and semi-automated.

#### Fully Automated Release

These commands handle the entire release process for you: they run safety checks, bump the version, create a commit and tag, and push everything to the remote repository to trigger the CI/CD pipeline.

```bash
# For a patch release (e.g., 0.1.0 → 0.1.1)
npm run release

# For a minor release (e.g., 0.1.0 → 0.2.0)
npm run release:minor

# For a major release (e.g., 0.1.0 → 1.0.0)
npm run release:major
```

There are no further steps; the push is handled automatically.

#### Semi-Automated Release (Manual Push)

If you want more control, you can use the `version:*` scripts. These will bump the version and create a local Git commit and tag, but they will **not** push to the remote repository. You must do that manually.

```bash
# Choose ONE of the following to bump the version:
npm run version:patch
npm run version:minor
npm run version:major

# Or for a specific version:
npm run version:bump 1.2.3

# Then, push the commit and tags manually to trigger the release:
git push --follow-tags
```

### Method 2: Manual Process

1. **Update version numbers** in three files:

   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`

2. **Commit the version changes**:

   ```bash
   git add .
   git commit -m "chore: bump version to v0.1.1"
   ```

3. **Create and push a tag**:
   First, define your branch and tag variables. For example:
   ```bash
   BRANCH="main" # or your release branch, e.g., "release/v1.2.3"
   TAG="v0.1.1" # or your desired tag, e.g., "v1.2.3"
   ```
   Then, create and push the tag, ensuring to push both the branch and the tag:
   ```bash
   git tag -a ${TAG} -m "Release ${TAG}"
   git push origin ${BRANCH}
   git push origin ${TAG}
   ```

### Method 3: Trigger Version Bump from GitHub

You can trigger a version bump and release from the GitHub Actions tab:

1. Go to Actions → Release
2. Click "Run workflow"
3. Choose the release type (`patch`, `minor`, or `major`)
4. Click "Run workflow"

   _Note: This bumps the version, creates a tag, and pushes it. The "Build and Release" workflow will automatically run when the tag is pushed._

### Method 4: Trigger Build Manually from GitHub

You can also trigger a build for an existing version:

1. Go to Actions → Build and Release
2. Click "Run workflow"
3. Enter the version to release (e.g., `v0.1.1`). **Note: A version must be specified to create a release.**
4. Click "Run workflow"

   _Note: This workflow does not bump versions or create tags. It builds and releases for the specified version. When no version is provided, only the build artifacts are created without a GitHub release._

### VERSION Environment Variable (Automated)

The `VERSION` environment variable is **automatically managed** by the GitHub Actions workflow and does not require manual configuration:

- **For tag pushes**: Extracted from the git tag (e.g., `v0.1.1`)
- **For manual triggers**: Uses the version input parameter
- **For non-release builds**: Defaults to `v0.1.0-dev`

The workflow handles this in `.github/workflows/build.yml`:
```yaml
# Automatically determines VERSION based on context
if [ "${{ github.event.inputs.version }}" != "" ]; then
  VERSION="${{ github.event.inputs.version }}"  # Manual input
elif [[ "$GITHUB_REF" == refs/tags/* ]]; then
  VERSION="${GITHUB_REF#refs/tags/}"            # From git tag
else
  VERSION="v0.1.0-dev"                          # Development build
fi
```

**You do not need to set this variable locally or in GitHub secrets.** The CI/CD pipeline handles it automatically based on how the workflow is triggered.

## Release Workflow

When you push a Git tag matching `v*` (for example `v1.2.3`), the 'Build and Release' workflow automatically:

1. **Creates a draft release** with auto-generated release notes
2. **Builds the app** for all platforms:
   - Windows: `.msi` installer
   - macOS Intel: `.dmg` disk image
   - macOS Apple Silicon: `.dmg` disk image
   - Linux: `.AppImage` (universal) and `.deb` (Debian/Ubuntu)
3. **Uploads artifacts** to the GitHub Release
4. **Publishes the release** when all builds complete successfully

## Platform-Specific Builds

### Windows

- Produces: `GTDSpace_v0.1.0_windows-x64.msi`
- Installer includes Start Menu shortcuts
- Auto-update support (future feature)

### macOS

- Intel: `GTDSpace_v0.1.0_macos-x64.dmg`
- Apple Silicon: `GTDSpace_v0.1.0_macos-aarch64.dmg`
- Drag-and-drop installation to Applications folder
- Code signing (when certificates are configured)

### Linux

- AppImage: `GTDSpace_v0.1.0_linux-x64.AppImage` (portable, works on most distributions)
- Debian package: `GTDSpace_v0.1.0_linux-x64.deb` (for Debian/Ubuntu)
- Includes desktop entry and icon

## Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0): Incompatible API changes or major feature overhauls
- **MINOR** (0.1.0): New features, backwards compatible
- **PATCH** (0.0.1): Bug fixes, backwards compatible

## Release Checklist

Before releasing:

- [ ] All tests passing
- [ ] No ESLint errors (`npm run lint`)
- [ ] TypeScript compiles without errors (`npm run type-check`)
- [ ] Rust checks pass (`cd src-tauri && cargo check`)
- [ ] Manual testing on at least one platform
- [ ] Version numbers updated in all three files
- [ ] Release notes prepared (for manual releases)

## Monitoring Releases

1. **GitHub Actions**: Monitor the build progress at [Actions tab](https://github.com/AustinKelsay/gtdspace/actions)
2. **Release Page**: View published releases at [Releases](https://github.com/AustinKelsay/gtdspace/releases)
3. **Download Stats**: GitHub provides download counts for each artifact

## Troubleshooting

### Build Failures

If a platform build fails:

1. Check the GitHub Actions logs for specific errors
2. Common issues:
   - Missing dependencies (especially Linux GTK libraries)
   - Rust compilation errors
   - Node version mismatches

### Version Mismatch

If you see version mismatch errors:

- Ensure all three files have the same version:
  - `package.json`
  - `src-tauri/Cargo.toml`
  - `src-tauri/tauri.conf.json`

### Tag Already Exists

If Git complains about an existing tag:

```bash
# Delete local tag
git tag -d v0.1.1

# Delete remote tag (use with caution!)
git push --delete origin v0.1.1

# Recreate and push
git tag -a v0.1.1 -m "Release v0.1.1"
git push origin v0.1.1
```

## Future Improvements

Planned enhancements to the release process:

1. **Code Signing**:
   - Windows: Certificate signing for SmartScreen
   - macOS: Apple Developer ID for notarization
2. **Auto-Update**:
   - Built-in update checking
   - Seamless background updates
3. **Release Channels**:

   - Stable releases
   - Beta/preview builds
   - Nightly builds (automated)

4. **Package Managers**:
   - Homebrew (macOS)
   - Chocolatey (Windows)
   - Snap/Flatpak (Linux)
   - AUR (Arch Linux)

## Security Considerations

- Never commit sensitive credentials to the repository
- Use GitHub Secrets for signing certificates
- Enable branch protection on `main`
- Require PR reviews before merging to `main`
- Use signed commits when possible

## Additional Resources

- [Tauri Publishing Guide](https://v2.tauri.app/distribute/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
