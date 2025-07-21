#!/usr/bin/env python3
"""
Converts PNG icons to RGBA format for Tauri compatibility.
Usage: python3 fix_icon.py [filename.png]
If no filename provided, converts icon.png
"""
import sys
import os

def convert_to_rgba(filename):
    try:
        from PIL import Image
        
        if not os.path.exists(filename):
            print(f"Error: {filename} not found")
            return False
            
        with Image.open(filename) as img:
            if img.mode != 'RGBA':
                rgba_img = img.convert('RGBA')
                rgba_img.save(filename)
                print(f"✓ Converted {filename} from {img.mode} to RGBA")
                return True
            else:
                print(f"✓ {filename} is already RGBA")
                return True
                
    except ImportError:
        print("PIL not available. Install with: pip install Pillow")
        return False
    except Exception as e:
        print(f"Error processing {filename}: {e}")
        return False

if __name__ == "__main__":
    filename = sys.argv[1] if len(sys.argv) > 1 else 'icon.png'
    success = convert_to_rgba(filename)
    sys.exit(0 if success else 1)