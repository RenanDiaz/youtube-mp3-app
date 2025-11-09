#!/usr/bin/env python3
"""
Icon Generation Script (Python alternative)
Converts SVG icons to PNG format using cairosvg

Installation:
    pip install cairosvg

Usage:
    python3 generate-icons.py
"""

import os
import sys

def main():
    print("Icon Generation Script (Python)")
    print("=" * 50)
    print()

    try:
        import cairosvg
        print("✓ cairosvg is installed")
        print()

        # Get the public directory path
        script_dir = os.path.dirname(os.path.abspath(__file__))
        public_dir = os.path.join(script_dir, 'public')

        # Define conversions
        conversions = [
            {
                'input': 'apple-touch-icon.png.svg',
                'output': 'apple-touch-icon.png',
                'size': 180
            },
            {
                'input': 'logo192.png.svg',
                'output': 'logo192.png',
                'size': 192
            },
            {
                'input': 'logo512.png.svg',
                'output': 'logo512.png',
                'size': 512
            }
        ]

        print("Generating PNG files...")
        print()

        for conv in conversions:
            input_path = os.path.join(public_dir, conv['input'])
            output_path = os.path.join(public_dir, conv['output'])

            if not os.path.exists(input_path):
                print(f"✗ Input file not found: {conv['input']}")
                continue

            try:
                cairosvg.svg2png(
                    url=input_path,
                    write_to=output_path,
                    output_width=conv['size'],
                    output_height=conv['size']
                )
                print(f"✓ Generated: {conv['output']} ({conv['size']}x{conv['size']})")
            except Exception as e:
                print(f"✗ Failed to generate {conv['output']}: {str(e)}")

        print()
        print("PNG generation complete!")
        print()
        print("Note: You still need to generate favicon.ico manually.")
        print("Visit: https://www.favicon-generator.org/")
        print("Upload: public/favicon.svg")
        print()

    except ImportError:
        print("cairosvg is not installed.")
        print()
        print("To install cairosvg:")
        print("  pip install cairosvg")
        print()
        print("Or use online converters:")
        print("  1. Visit: https://cloudconvert.com/svg-to-png")
        print("  2. Upload SVG files from public/ directory")
        print("  3. Download and rename as needed")
        print()
        print("Required files:")
        print("  - apple-touch-icon.png.svg → apple-touch-icon.png (180x180)")
        print("  - logo192.png.svg → logo192.png (192x192)")
        print("  - logo512.png.svg → logo512.png (512x512)")
        print()
        sys.exit(1)

if __name__ == '__main__':
    main()
