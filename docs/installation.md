# Installation Guide

This guide provides detailed instructions for setting up GTD Space on your development machine.

## Prerequisites

### Required Software

1. **Node.js v18 or higher**
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify installation: `node --version`
   - npm is included with Node.js

2. **Rust (latest stable)**
   - Install via [rustup](https://rustup.rs/):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
   - Verify installation: `rustc --version`

### Platform-Specific Dependencies

#### macOS

1. **Xcode Command Line Tools**
   ```bash
   xcode-select --install
   ```

2. **Additional Requirements**
   - macOS 10.15 (Catalina) or later
   - No additional dependencies needed

#### Windows

1. **Microsoft C++ Build Tools**
   - Download from [Visual Studio Downloads](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   - Install with "Desktop development with C++" workload

2. **WebView2**
   - Usually pre-installed on Windows 10/11
   - If missing, download from [Microsoft Edge WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

#### Linux

Install the following packages based on your distribution:

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
```

**Fedora/RHEL:**
```bash
sudo dnf install webkit2gtk4.0-devel \
    openssl-devel \
    gtk3-devel \
    libappindicator-gtk3-devel \
    librsvg2-devel
```

**Arch Linux:**
```bash
sudo pacman -S webkit2gtk \
    base-devel \
    curl \
    wget \
    openssl \
    appmenu-gtk-module \
    gtk3 \
    libappindicator-gtk3 \
    librsvg \
    libvips
```

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/gtdspace.git
cd gtdspace
```

### 2. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Rust dependencies are automatically handled by Cargo
```

### 3. Development Setup

```bash
# Run the development server
npm run tauri:dev
```

This command will:
- Start the Vite development server for the frontend
- Build and run the Rust backend
- Open the application window
- Enable hot module replacement for frontend changes
- Watch for Rust changes and rebuild automatically

### 4. Production Build

```bash
# Build for your current platform
npm run tauri:build
```

The built application will be in:
- **macOS**: `src-tauri/target/release/bundle/dmg/`
- **Windows**: `src-tauri/target/release/bundle/msi/`
- **Linux**: `src-tauri/target/release/bundle/appimage/` or `deb/`

## Troubleshooting

### Common Issues

#### "Tauri build fails"
- Ensure all platform-specific dependencies are installed
- Check Rust toolchain: `rustup update`
- Clear build cache: `cd src-tauri && cargo clean`

#### "File operations not working"
- Make sure you're running `npm run tauri:dev`, not `npm run dev`
- The frontend-only dev server (`npm run dev`) doesn't have Tauri APIs

#### "Node modules issues"
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### "Rust compilation errors"
```bash
# Update Rust toolchain
rustup update

# Clear Cargo cache
cd src-tauri
cargo clean
cargo update
```

### Development Tips

1. **VSCode Setup**
   - Install Rust Analyzer extension
   - Install Tauri extension
   - Enable format on save for both TypeScript and Rust

2. **Performance**
   - Use `npm run tauri:dev --release` for release-mode performance testing
   - Monitor console for Rust debug output

3. **Debugging**
   - Frontend: Use browser DevTools (Right-click → Inspect)
   - Backend: Check terminal output for Rust logs
   - Enable Rust backtrace: `RUST_BACKTRACE=1 npm run tauri:dev`

## Next Steps

After successful installation:
1. Read the [Architecture Overview](architecture.md) to understand the codebase
2. Check [Development Workflow](development.md) for coding guidelines
3. See [Contributing Guidelines](../CONTRIBUTING.md) before submitting PRs