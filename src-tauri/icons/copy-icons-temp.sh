#!/bin/bash

# Temporary solution: Copy icon.png to all required formats
# This is just for getting builds working - proper resizing recommended for production

echo "Creating temporary icon files from icon.png..."

if [ ! -f "icon.png" ]; then
    echo "Error: icon.png not found"
    exit 1
fi

# Copy to all required filenames
cp icon.png 32x32.png
cp icon.png 128x128.png
cp icon.png 128x128@2x.png
cp icon.png icon.ico
cp icon.png icon.icns

echo "✓ Temporary icon files created"
echo ""
echo "⚠ Warning: These are not properly sized icons!"
echo "For production, please generate proper icons using:"
echo "  - Python: python3 generate_icons.py (requires Pillow)"
echo "  - Shell: ./generate-icons.sh (requires ImageMagick)"
echo ""
echo "The GitHub Actions workflow will generate proper icons automatically."