#!/bin/bash

# Enable strict mode for safety
set -euo pipefail
IFS=$'\n\t'

# Get the directory of this script and cd to it
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Temporary solution: Generate proper icon files from icon.png
echo "Creating icon files from icon.png..."

if [ ! -f "icon.png" ]; then
    echo "Error: icon.png not found in $DIR"
    exit 1
fi

# Track what we can generate
GENERATED_ICO=false
GENERATED_ICNS=false

# Copy PNG files (always works)
cp icon.png 32x32.png
cp icon.png 128x128.png
cp icon.png 128x128@2x.png
echo "✓ Created PNG copies (not properly sized)"

# Try to generate real ICO file for Windows
if command -v convert &> /dev/null; then
    # ImageMagick is available
    convert icon.png -resize 256x256 -define icon:auto-resize="256,128,96,64,48,32,16" icon.ico 2>/dev/null && {
        echo "✓ Generated proper icon.ico using ImageMagick"
        GENERATED_ICO=true
    } || {
        echo "⚠ ImageMagick failed to generate icon.ico"
    }
elif command -v icotool &> /dev/null; then
    # icotool is available (Linux)
    icotool -c -o icon.ico icon.png 2>/dev/null && {
        echo "✓ Generated proper icon.ico using icotool"
        GENERATED_ICO=true
    } || {
        echo "⚠ icotool failed to generate icon.ico"
    }
fi

# If we couldn't generate a real ICO, create PNG copies but warn
if [ "$GENERATED_ICO" = false ]; then
    cp icon.png icon.ico
    echo "⚠ WARNING: Created icon.ico as PNG copy (not a real ICO file!)"
    echo "  Windows builds may fail. Install ImageMagick or icotool to generate proper ICO."
fi

# Try to generate real ICNS file for macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # We're on macOS
    if command -v iconutil &> /dev/null; then
        # Create iconset with required sizes
        mkdir -p icon.iconset
        
        # Use sips (built-in on macOS) to resize if available
        if command -v sips &> /dev/null; then
            sips -z 16 16 icon.png --out icon.iconset/icon_16x16.png &>/dev/null
            sips -z 32 32 icon.png --out icon.iconset/icon_16x16@2x.png &>/dev/null
            sips -z 32 32 icon.png --out icon.iconset/icon_32x32.png &>/dev/null
            sips -z 64 64 icon.png --out icon.iconset/icon_32x32@2x.png &>/dev/null
            sips -z 128 128 icon.png --out icon.iconset/icon_128x128.png &>/dev/null
            sips -z 256 256 icon.png --out icon.iconset/icon_128x128@2x.png &>/dev/null
            sips -z 256 256 icon.png --out icon.iconset/icon_256x256.png &>/dev/null
            sips -z 512 512 icon.png --out icon.iconset/icon_256x256@2x.png &>/dev/null
            sips -z 512 512 icon.png --out icon.iconset/icon_512x512.png &>/dev/null
            sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png &>/dev/null
        else
            # Fall back to just copying
            for size in 16x16 32x32 128x128 256x256 512x512; do
                cp icon.png "icon.iconset/icon_${size}.png"
                cp icon.png "icon.iconset/icon_${size}@2x.png"
            done
        fi
        
        # Generate ICNS
        iconutil -c icns icon.iconset 2>/dev/null && {
            echo "✓ Generated proper icon.icns using iconutil"
            GENERATED_ICNS=true
        } || {
            echo "⚠ iconutil failed to generate icon.icns"
        }
        
        # Clean up
        rm -rf icon.iconset
    fi
else
    # Not on macOS
    if command -v png2icns &> /dev/null; then
        # Try png2icns (available on some Linux distros)
        png2icns icon.icns icon.png 2>/dev/null && {
            echo "✓ Generated icon.icns using png2icns"
            GENERATED_ICNS=true
        } || {
            echo "⚠ png2icns failed to generate icon.icns"
        }
    fi
fi

# If we couldn't generate a real ICNS, create PNG copy but warn
if [ "$GENERATED_ICNS" = false ]; then
    cp icon.png icon.icns
    echo "⚠ WARNING: Created icon.icns as PNG copy (not a real ICNS file!)"
    echo "  macOS builds may fail. Use a macOS machine with iconutil to generate proper ICNS."
fi

echo ""
echo "✓ Temporary icon files created"
echo ""

# Show warnings summary if needed
if [ "$GENERATED_ICO" = false ] || [ "$GENERATED_ICNS" = false ]; then
    echo "⚠ IMPORTANT: Some icons are not in proper format!"
    echo ""
    if [ "$GENERATED_ICO" = false ]; then
        echo "  - icon.ico is a PNG copy (not a real ICO)"
        echo "    Install ImageMagick: brew install imagemagick (macOS)"
        echo "                        apt-get install imagemagick (Linux)"
    fi
    if [ "$GENERATED_ICNS" = false ]; then
        echo "  - icon.icns is a PNG copy (not a real ICNS)"
        echo "    Generate on macOS or use: python3 generate_icons.py"
    fi
    echo ""
    echo "For production builds, please use:"
    echo "  - Python: python3 generate_icons.py (requires Pillow)"
    echo "  - Shell: ./generate-icons.sh (requires ImageMagick)"
    echo ""
    echo "The GitHub Actions workflow will generate proper icons automatically."
fi