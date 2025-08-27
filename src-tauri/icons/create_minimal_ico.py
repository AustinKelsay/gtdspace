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
    
    # Dimensions
    width = 16
    height = 16

    # Compute sizes
    pixel_data_size = width * height * 4  # BGRA, 32bpp
    mask_row_size = ((width + 31) // 32) * 4  # DWORD aligned rows
    mask_size = mask_row_size * height       # 1-bit AND mask total size

    # Image size for directory entry includes BMP header + pixel data + mask
    ico_image_size = 40 + pixel_data_size + mask_size

    # Icon directory entry
    ico_entry = struct.pack('<BBBBHHII',
        width if width < 256 else 0,    # Width (0 = 256)
        height if height < 256 else 0,  # Height (0 = 256)
        0,      # Color palette
        0,      # Reserved
        1,      # Color planes
        32,     # Bits per pixel
        ico_image_size,  # Size of image data
        22      # Offset to image data
    )
    
    # BMP info header
    bmp_header = struct.pack('<IIIHHIIIIII',
        40,                 # Header size
        width,              # Width
        height * 2,         # Height (times two: XOR + AND)
        1,                  # Color planes
        32,                 # Bits per pixel
        0,                  # Compression (none)
        pixel_data_size + mask_size,  # Image size includes XOR + AND masks
        0,                  # X pixels per meter
        0,                  # Y pixels per meter
        0,                  # Colors used
        0                   # Important colors
    )
    
    # Create a simple 16x16 blue square
    pixel_data = b'\x00\x00\xFF\xFF' * (width * height)  # BGRA format
    and_mask = b'\x00' * mask_size
    
    # Write the ICO file
    with open('icon.ico', 'wb') as f:
        f.write(ico_header)
        f.write(ico_entry)
        f.write(bmp_header)
        f.write(pixel_data)
        # Write 1-bit AND mask, zeroed (fully opaque), rows DWORD-aligned
        f.write(and_mask)
    
    print("Created minimal icon.ico")
    return True

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    create_minimal_ico()