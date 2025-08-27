#!/usr/bin/env python3
"""
Create a minimal valid ICO file that Windows Resource Compiler will accept.
This is a temporary workaround until proper icon generation tools are available.
"""

import struct
import os

def create_minimal_ico():
    """Create a minimal 16x16 ICO file that Windows will accept."""
    
    # ICO header
    ico_header = struct.pack('<HHH', 
        0,      # Reserved, must be 0
        1,      # Type (1 for icon)
        1       # Number of images
    )
    
    # Icon directory entry
    ico_entry = struct.pack('<BBBBHHII',
        16,     # Width (0 = 256)
        16,     # Height (0 = 256)
        0,      # Color palette
        0,      # Reserved
        1,      # Color planes
        32,     # Bits per pixel
        40 + 16*16*4,  # Size of image data
        22      # Offset to image data
    )
    
    # BMP info header
    bmp_header = struct.pack('<IIIHHIIIIII',
        40,     # Header size
        16,     # Width
        32,     # Height (double for icon)
        1,      # Color planes
        32,     # Bits per pixel
        0,      # Compression (none)
        16*16*4,# Image size
        0,      # X pixels per meter
        0,      # Y pixels per meter
        0,      # Colors used
        0       # Important colors
    )
    
    # Create a simple 16x16 blue square
    pixel_data = b'\x00\x00\xFF\xFF' * (16 * 16)  # BGRA format
    
    # Write the ICO file
    with open('icon.ico', 'wb') as f:
        f.write(ico_header)
        f.write(ico_entry)
        f.write(bmp_header)
        f.write(pixel_data)
    
    print("Created minimal icon.ico")
    return True

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    create_minimal_ico()