"""
Connexio Icon Generator
Usage: python scripts/generate-icons.py <path-to-1024x1024-png>

Generates all icon formats needed for the app from a single source image.
"""

import sys
import os
from PIL import Image, ImageFilter, ImageEnhance

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/generate-icons.py <path-to-png>")
        print("  Input should be 512x512 or larger (1024x1024 recommended)")
        sys.exit(1)

    src_path = sys.argv[1]
    if not os.path.exists(src_path):
        print(f"Error: File not found: {src_path}")
        sys.exit(1)

    src = Image.open(src_path).convert("RGBA")
    print(f"Source: {src.size[0]}x{src.size[1]} ({src_path})")

    if src.size[0] < 512 or src.size[1] < 512:
        print("Warning: Source image is smaller than 512x512, quality may be poor")

    # Project root (script is in scripts/)
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # --- Generate PNGs ---

    # assets/icon.png (512x512)
    icon512 = src.resize((512, 512), Image.LANCZOS)
    icon512.save(os.path.join(root, "assets", "icon.png"))
    print("  [OK] assets/icon.png (512x512)")

    # assets/icon-24.png
    icon24 = src.resize((24, 24), Image.LANCZOS)
    icon24.save(os.path.join(root, "assets", "icon-24.png"))
    print("  [OK] assets/icon-24.png (24x24)")

    # src/renderer/assets/icon.png (512x512)
    icon512.save(os.path.join(root, "src", "renderer", "assets", "icon.png"))
    print("  [OK] src/renderer/assets/icon.png (512x512)")

    # src/renderer/assets/favicon.png (32x32)
    favicon = src.resize((32, 32), Image.LANCZOS)
    favicon.save(os.path.join(root, "src", "renderer", "assets", "favicon.png"))
    print("  [OK] src/renderer/assets/favicon.png (32x32)")

    # --- Tauri icons (oversized PNGs for better downscaling) ---

    tauri_icons = os.path.join(root, "src-tauri", "icons")

    # 32x32.png — use 512x512 for sharp taskbar
    icon512.save(os.path.join(tauri_icons, "32x32.png"))
    print("  [OK] src-tauri/icons/32x32.png (512x512 oversized)")

    # 128x128.png — use 512x512
    icon512.save(os.path.join(tauri_icons, "128x128.png"))
    print("  [OK] src-tauri/icons/128x128.png (512x512 oversized)")

    # 128x128@2x.png — use 512x512
    icon512.save(os.path.join(tauri_icons, "128x128@2x.png"))
    print("  [OK] src-tauri/icons/128x128@2x.png (512x512 oversized)")

    # icon.icns — save as PNG (Tauri handles conversion)
    icon512.save(os.path.join(tauri_icons, "icon.icns"))
    print("  [OK] src-tauri/icons/icon.icns (512x512)")

    # --- Generate ICO (multi-resolution) ---

    ico_sizes = [256, 128, 64, 48, 32, 24, 16]
    ico_images = [src.resize((s, s), Image.LANCZOS) for s in ico_sizes]

    # Save ICO files
    ico_path_tauri = os.path.join(tauri_icons, "icon.ico")
    ico_path_assets = os.path.join(root, "assets", "icon.ico")

    ico_images[0].save(ico_path_tauri, format="ICO", append_images=ico_images[1:])
    ico_images[0].save(ico_path_assets, format="ICO", append_images=ico_images[1:])
    print(f"  [OK] src-tauri/icons/icon.ico ({', '.join(f'{s}px' for s in ico_sizes)})")
    print(f"  [OK] assets/icon.ico ({', '.join(f'{s}px' for s in ico_sizes)})")

    print()
    print("Done! All icons generated.")
    print("Restart 'npm run dev' to see changes.")


if __name__ == "__main__":
    main()
