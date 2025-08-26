#!/bin/bash

# Generate all required icon sizes from icon.png
# Requires ImageMagick (install with: brew install imagemagick)

# Check if icon.png exists
if [ ! -f "icon.png" ]; then
    echo "Error: icon.png not found in current directory"
    echo "Please ensure you have a high-resolution icon.png (at least 512x512) in src-tauri/icons/"
    exit 1
fi

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "ImageMagick is required but not installed."
    echo "Install it with:"
    echo "  macOS: brew install imagemagick"
    echo "  Ubuntu/Debian: sudo apt-get install imagemagick"
    echo "  Windows: Download from https://imagemagick.org/script/download.php"
    exit 1
fi

echo "Generating icons from icon.png..."

# Generate PNG icons for Linux/General use
convert icon.png -resize 32x32 32x32.png
echo "✓ Generated 32x32.png"

convert icon.png -resize 128x128 128x128.png
echo "✓ Generated 128x128.png"

convert icon.png -resize 256x256 128x128@2x.png
echo "✓ Generated 128x128@2x.png (256x256)"

# Generate ICO for Windows (multiple sizes in one file)
convert icon.png -resize 256x256 -define icon:auto-resize="256,128,96,64,48,32,16" icon.ico
echo "✓ Generated icon.ico (Windows)"

# Generate ICNS for macOS
# First create the required sizes
mkdir -p icon.iconset
convert icon.png -resize 16x16 icon.iconset/icon_16x16.png
convert icon.png -resize 32x32 icon.iconset/icon_16x16@2x.png
convert icon.png -resize 32x32 icon.iconset/icon_32x32.png
convert icon.png -resize 64x64 icon.iconset/icon_32x32@2x.png
convert icon.png -resize 128x128 icon.iconset/icon_128x128.png
convert icon.png -resize 256x256 icon.iconset/icon_128x128@2x.png
convert icon.png -resize 256x256 icon.iconset/icon_256x256.png
convert icon.png -resize 512x512 icon.iconset/icon_256x256@2x.png
convert icon.png -resize 512x512 icon.iconset/icon_512x512.png
convert icon.png -resize 1024x1024 icon.iconset/icon_512x512@2x.png

# Create ICNS file (macOS only)
if [[ "$OSTYPE" == "darwin"* ]]; then
    iconutil -c icns icon.iconset
    echo "✓ Generated icon.icns (macOS)"
else
    echo "⚠ Skipping icon.icns generation (requires macOS)"
    # Create a placeholder or use png2icns if available
    if command -v png2icns &> /dev/null; then
        png2icns icon.icns icon.iconset/*.png
        echo "✓ Generated icon.icns using png2icns"
    fi
fi

# Clean up
rm -rf icon.iconset

echo ""
echo "✅ Icon generation complete!"
echo "All required icons have been generated in src-tauri/icons/"