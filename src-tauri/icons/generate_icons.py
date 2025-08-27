#!/usr/bin/env python3
"""
Generate all required icon sizes for Tauri from a single icon.png
Requires: pip install Pillow
"""

import os
import sys

try:
    from PIL import Image
except ImportError:
    print("Pillow is required but not installed.")
    print("Install it with: pip install Pillow")
    sys.exit(1)

def generate_icons():
    # Check if source icon exists
    source_icon = "icon.png"
    if not os.path.exists(source_icon):
        print(f"Error: {source_icon} not found")
        print("Please ensure you have icon.png in src-tauri/icons/")
        return False
    
    try:
        # Open the source icon
        with Image.open(source_icon) as img:
            # Convert to RGBA if needed
            orig_mode = img.mode
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
                print(f"Converted to RGBA from {orig_mode}")
            
            # Define sizes needed for different platforms
            sizes = [
                ("32x32.png", (32, 32)),
                ("128x128.png", (128, 128)),
                ("128x128@2x.png", (256, 256)),  # Retina display
            ]
            
            # Generate PNG files
            for filename, size in sizes:
                resized = img.resize(size, Image.Resampling.LANCZOS)
                resized.save(filename, 'PNG')
                print(f"✓ Generated {filename} ({size[0]}x{size[1]})")
            
            # Generate Windows ICO with multiple sizes for better compatibility
            # Windows Resource Compiler expects specific sizes
            base_ico = img.resize((256, 256), Image.Resampling.LANCZOS)
            base_ico.save(
                "icon.ico",
                format='ICO',
                sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
            )
            print("✓ Generated icon.ico (Windows - multi-resolution)")
            
            # macOS ICNS generation
            import platform
            import subprocess
            
            if platform.system() == "Darwin":  # We're on macOS
                try:
                    # Try using Tauri CLI to generate proper ICNS
                    result = subprocess.run(
                        ["npx", "--yes", "@tauri-apps/cli@latest", "icon", "./icon.png"],
                        capture_output=True,
                        text=True,
                        timeout=30
                    )
                    if result.returncode == 0:
                        print("✓ Generated icon.icns using Tauri CLI")
                    else:
                        raise Exception(f"Tauri CLI failed: {result.stderr}")
                except Exception as e:
                    print(f"⚠ Could not generate ICNS with Tauri CLI: {e}")
                    print("  Falling back to iconutil...")
                    
                    try:
                        # Create iconset directory
                        os.makedirs("icon.iconset", exist_ok=True)
                        
                        # Generate all required sizes for iconset
                        icon_sizes = [
                            (16, "icon_16x16.png"),
                            (32, "icon_16x16@2x.png"),
                            (32, "icon_32x32.png"),
                            (64, "icon_32x32@2x.png"),
                            (128, "icon_128x128.png"),
                            (256, "icon_128x128@2x.png"),
                            (256, "icon_256x256.png"),
                            (512, "icon_256x256@2x.png"),
                            (512, "icon_512x512.png"),
                            (1024, "icon_512x512@2x.png"),
                        ]
                        
                        for size, filename in icon_sizes:
                            resized = img.resize((size, size), Image.Resampling.LANCZOS)
                            resized.save(f"icon.iconset/{filename}", 'PNG')
                        
                        # Use iconutil to create ICNS
                        subprocess.run(["iconutil", "-c", "icns", "icon.iconset"], check=True)
                        print("✓ Generated icon.icns using iconutil")
                        
                        except Exception as e2:
                        print(f"⚠ Could not generate proper ICNS: {e2}")
                        print("  Tauri will handle this during build")
                    finally:
                        # Clean up
                        import shutil
                        if os.path.exists("icon.iconset"):
                            shutil.rmtree("icon.iconset")
            else:
                print("⚠ Not on macOS - skipping ICNS generation")
                print("  ICNS will be generated during macOS builds")
            
            print("\n✅ Icon generation complete!")
            print("All required icons have been generated in src-tauri/icons/")
            return True
            
    except Exception as e:
        print(f"Error generating icons: {e}")
        return False

if __name__ == "__main__":
    success = generate_icons()
    sys.exit(0 if success else 1)