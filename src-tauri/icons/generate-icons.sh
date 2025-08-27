#!/bin/bash

# Enable strict mode for safety
set -euo pipefail
IFS=$'\n\t'

# Get the directory of this script and cd to it
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Generate all required icon sizes from icon.png
# Requires ImageMagick (install with: brew install imagemagick)

# Check if icon.png exists
if [ ! -f "icon.png" ]; then
    echo "Error: icon.png not found in $DIR"
    echo "Please ensure you have a high-resolution icon.png (at least 512x512) in src-tauri/icons/"
    exit 1
fi

# Detect ImageMagick executable (prefer 'magick' over 'convert')
IM_BIN=""
 if command -v magick &> /dev/null; then
     IM_BIN="magick"
 elif command -v convert &> /dev/null; then
     IM_BIN="convert"
     # Ensure 'convert' is ImageMagick, not Windows NTFS or GraphicsMagick
     if ! convert -version 2>&1 | grep -qi "ImageMagick"; then
         echo "Found 'convert' but it's not ImageMagick. Install ImageMagick v7 ('magick') or ensure PATH points to ImageMagick's 'convert'."
         exit 1
     fi
 else
     echo "ImageMagick is required but not installed or not on PATH."
     echo "Install it with:"
     echo "  macOS: brew install imagemagick"
     echo "  Ubuntu/Debian: sudo apt-get install imagemagick"
     echo "  Windows: Download from https://imagemagick.org/script/download.php"
     exit 1
 fi

# Normalize convert invocation for ImageMagick v7 ('magick') and v6 ('convert')
if [ "$IM_BIN" = "magick" ]; then
    IM_CONVERT="${IM_BIN} convert"
else
    IM_CONVERT="${IM_BIN}"
fi
export IM_BIN

echo "Generating icons from icon.png..."

# Generate PNG icons for Linux/General use
${IM_CONVERT} icon.png -resize 32x32 32x32.png
echo "✓ Generated 32x32.png"

${IM_CONVERT} icon.png -resize 128x128 128x128.png
echo "✓ Generated 128x128.png"

${IM_CONVERT} icon.png -resize 256x256 128x128@2x.png
echo "✓ Generated 128x128@2x.png (256x256)"

# Generate ICO for Windows (multiple sizes in one file)
# Create individual sizes first for better compatibility
${IM_CONVERT} icon.png -resize 16x16 icon-16.png
${IM_CONVERT} icon.png -resize 32x32 icon-32.png
${IM_CONVERT} icon.png -resize 48x48 icon-48.png
${IM_CONVERT} icon.png -resize 64x64 icon-64.png
${IM_CONVERT} icon.png -resize 128x128 icon-128.png
${IM_CONVERT} icon.png -resize 256x256 icon-256.png

# Create ICO with proper format for Windows Resource Compiler
${IM_CONVERT} icon-16.png icon-32.png icon-48.png icon-64.png icon-128.png icon-256.png -colors 256 icon.ico

# Clean up temporary files
rm -f icon-16.png icon-32.png icon-48.png icon-64.png icon-128.png icon-256.png

echo "✓ Generated icon.ico (Windows)"

# Setup cleanup trap to ensure icon.iconset is removed even on error
cleanup() {
    rm -rf icon.iconset
}
trap cleanup EXIT

# Generate ICNS for macOS
# First create the required sizes
mkdir -p icon.iconset
${IM_CONVERT} icon.png -resize 16x16 icon.iconset/icon_16x16.png
${IM_CONVERT} icon.png -resize 32x32 icon.iconset/icon_16x16@2x.png
${IM_CONVERT} icon.png -resize 32x32 icon.iconset/icon_32x32.png
${IM_CONVERT} icon.png -resize 64x64 icon.iconset/icon_32x32@2x.png
${IM_CONVERT} icon.png -resize 128x128 icon.iconset/icon_128x128.png
${IM_CONVERT} icon.png -resize 256x256 icon.iconset/icon_128x128@2x.png
${IM_CONVERT} icon.png -resize 256x256 icon.iconset/icon_256x256.png
${IM_CONVERT} icon.png -resize 512x512 icon.iconset/icon_256x256@2x.png
${IM_CONVERT} icon.png -resize 512x512 icon.iconset/icon_512x512.png
${IM_CONVERT} icon.png -resize 1024x1024 icon.iconset/icon_512x512@2x.png

# Create ICNS file (macOS only)
if [[ "$OSTYPE" == "darwin"* ]]; then
    if command -v iconutil &> /dev/null; then
        iconutil -c icns icon.iconset
        echo "✓ Generated icon.icns (macOS)"
    else
        echo "⚠ iconutil not found; attempting png2icns..."
        if command -v png2icns &> /dev/null; then
            png2icns icon.icns icon.iconset/*.png
            echo "✓ Generated icon.icns using png2icns"
        else
            echo "⚠ Skipping icon.icns generation (iconutil/png2icns not available)"
        fi
    fi
else
    echo "⚠ Skipping icon.icns generation (requires macOS)"
    # Create a placeholder or use png2icns if available
    if command -v png2icns &> /dev/null; then
        png2icns icon.icns icon.iconset/*.png
        echo "✓ Generated icon.icns using png2icns"
    fi
fi

echo ""
echo "✅ Icon generation complete!"
echo "All required icons have been generated in src-tauri/icons/"