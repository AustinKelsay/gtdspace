# Build Setup Guide

## Prerequisites for Building GTD Space

### Required Software

1. **Node.js** (v18+)
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify: `node --version`

2. **Rust** (latest stable)
   - Install from [rustup.rs](https://rustup.rs/)
   - Verify: `rustc --version`

3. **Platform-specific requirements**:

   **macOS:**
   - Xcode Command Line Tools: `xcode-select --install`
   
   **Windows:**
   - Visual Studio 2022 Build Tools with "Desktop development with C++" workload
   - WebView2 (usually pre-installed on Windows 10/11)
   
   **Linux:**
   ```bash
   sudo apt update
   sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev \
     libayatana-appindicator3-dev librsvg2-dev patchelf
   ```

### Icon Generation

GTD Space requires application icons in multiple formats. You have several options:

#### Option 1: Use the provided scripts (Recommended)

**Python method** (cross-platform):
```bash
pip install Pillow
cd src-tauri/icons
python3 generate_icons.py
```

**Shell script method** (requires ImageMagick):
```bash
# Install ImageMagick first:
# macOS: brew install imagemagick
# Linux: sudo apt install imagemagick

cd src-tauri/icons
./generate-icons.sh
```

#### Option 2: Use online tools

If you don't have the required tools installed, you can use online converters:
1. [CloudConvert](https://cloudconvert.com/png-to-ico) for ICO files
2. [ConvertICO](https://convertico.com/) for various formats

Required icon files:
- `32x32.png` - Small icon
- `128x128.png` - Medium icon  
- `128x128@2x.png` - Retina display (256x256)
- `icon.ico` - Windows icon
- `icon.icns` - macOS icon

#### Option 3: Use placeholder icons

For development/testing, you can copy the base icon:
```bash
cd src-tauri/icons
cp icon.png 32x32.png
cp icon.png 128x128.png
cp icon.png 128x128@2x.png
cp icon.png icon.ico
cp icon.png icon.icns
```

Note: This will work for testing but won't look good in production.

## Building Locally

### Development Build
```bash
npm install
npm run tauri:dev
```

### Production Build
```bash
npm install
npm run tauri:build
```

The built application will be in:
- Windows: `src-tauri/target/release/bundle/msi/`
- macOS: `src-tauri/target/release/bundle/dmg/`
- Linux: `src-tauri/target/release/bundle/appimage/` and `/deb/`

## Troubleshooting

### Icon Errors

If you get icon-related errors during build:
1. Ensure all required icon files exist in `src-tauri/icons/`
2. Check that `bundle.active = true` in `tauri.conf.json`
3. Verify icon paths in the bundle.icon array

### Build Failures

**"cargo not found"**
- Install Rust: https://rustup.rs/

**"GTK/Webkit not found" (Linux)**
- Install required libraries (see Linux prerequisites above)

**"node not found"**
- Install Node.js v18+: https://nodejs.org/

### Bundle Not Created

If the build succeeds but no installer is created:
- Check `src-tauri/tauri.conf.json`
- Ensure `bundle.active = true`
- Verify `bundle.targets = "all"` or specific targets

## CI/CD Builds

The GitHub Actions workflow automatically:
1. Generates icons from `icon.png`
2. Builds for all platforms
3. Creates installers/bundles
4. Uploads to GitHub Releases

No local setup needed for CI/CD builds - everything is handled in the workflow.