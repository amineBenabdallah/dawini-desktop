# App Icons

Before building, generate platform-specific icons from the SVG:

## Required files:
- `icon.ico` — Windows (256x256, multi-resolution)
- `icon.icns` — macOS (1024x1024)
- `icon.png` — Linux (512x512)

## Generate from SVG:
Use https://cloudconvert.com or a tool like `electron-icon-maker`:

```bash
npx electron-icon-maker --input=icon.svg --output=./
```
