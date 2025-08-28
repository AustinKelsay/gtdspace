# Icon Generation Guide

## Overview

GTD Space requires application icons in multiple formats for different platforms:

- **PNG files**: 32x32.png, 128x128.png, 128x128@2x.png for Linux and general use
- **ICO file**: Multi-resolution icon for Windows
- **ICNS file**: Apple Icon Image format for macOS

## Important Notes

### ICNS File Requirements

- **ICNS files MUST be proper Apple Icon Image format**, not renamed PNGs
- Invalid ICNS files will cause macOS build failures
- ICNS generation requires macOS-specific tools

## Automated Generation (CI/CD)

The GitHub Actions workflow handles icon generation automatically:

1. Uses the NPM script (`npm run icons:generate`) to generate all formats
2. Leverages Tauri CLI for cross-platform icon generation
3. Creates PNG, ICO, and ICNS files as needed
4. Automatically cleans up unnecessary files

## Local Generation

### Method 1: NPM Script (Recommended)

**Prerequisites**: Ensure `src-tauri/icons/icon.png` exists (your source icon).

```bash
# From project root
npm run icons:generate
```

This script (located at `scripts/icons-generate.mjs`):

- ✅ Uses Tauri CLI to generate all required icon formats
- ✅ Creates all PNG sizes correctly
- ✅ Creates valid ICO file for Windows
- ✅ Creates proper ICNS file for macOS
- ✅ Automatically cleans up unnecessary files
- ✅ Works cross-platform

### Method 2: Using Tauri CLI Directly

On macOS, you can use Tauri's icon command:

```bash
cd src-tauri/icons
npx @tauri-apps/cli icon ./icon.png
```

This will generate all required formats including a proper ICNS.

### Method 3: Manual Generation on macOS

If you need to manually create an ICNS:

```bash
# Create iconset directory
mkdir icon.iconset

# Generate required sizes (use any image editor or ImageMagick)
# Required files in icon.iconset/:
# icon_16x16.png, icon_16x16@2x.png, icon_32x32.png, icon_32x32@2x.png,
# icon_128x128.png, icon_128x128@2x.png, icon_256x256.png, icon_256x256@2x.png,
# icon_512x512.png, icon_512x512@2x.png

# Convert to ICNS
iconutil -c icns icon.iconset

# Clean up
rm -rf icon.iconset
```

## Troubleshooting

### "Invalid ICNS file" Error on macOS Build

**Problem**: Build fails with ICNS-related errors.

**Cause**: The icon.icns file is actually a renamed PNG, not a proper ICNS.

**Solution**:

1. Delete the invalid `icon.icns`
2. Run `npm run icons:generate` on macOS (or check package.json for the exact script name)
3. Or use `npx @tauri-apps/cli icon ./icon.png`

### Icon Generation Fails in CI

**Problem**: GitHub Actions can't generate icons.

**Possible causes**:

- Missing `icon.png` source file
- Python/Pillow installation issues

**Solution**:

- Ensure `src-tauri/icons/icon.png` exists in your repository
- **Note**: The script will fail the build (exit code 1) if the source icon is missing
- To fix: Either add `src-tauri/icons/icon.png` to your repository, or modify the icon generation script to handle missing files gracefully (exit 0 to skip)

### Windows ICO Appears Blurry

**Problem**: Windows icon looks pixelated.

**Solution**: Ensure your source `icon.png` is at least 256x256 pixels, preferably 512x512 or larger.

## Best Practices

1. **Source Icon**: Use a high-resolution (512x512 or 1024x1024) PNG with transparency
2. **Version Control**: Only commit `icon.png` and generation scripts, not generated icons
3. **CI/CD**: Let GitHub Actions handle platform-specific generation
4. **Testing**: Verify icons look correct on each platform after building

## Platform-Specific Notes

### Windows

- ICO files should contain multiple resolutions (16, 32, 48, 256)
- Pillow's ICO generation is sufficient for most cases

### macOS

- ICNS must be in Apple's format, not renamed PNG
- Requires macOS to generate properly (iconutil or Tauri CLI)
- The build will fail if ICNS is invalid

### Linux

- Uses PNG files directly
- Supports multiple sizes for different contexts

## Quick Start for New Projects

1. Add a high-res `icon.png` (512x512 minimum) to `src-tauri/icons/`
2. Run `npm run icons:generate` locally (or check package.json for the exact script name)
3. Commit only `icon.png` and scripts
4. Let CI/CD handle the rest

The automated workflow ensures correct icon generation for each platform during the build process.
