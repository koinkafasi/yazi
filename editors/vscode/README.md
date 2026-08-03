# imlec-typer — VS Code Extension

Particle effects at your cursor while typing. A Power Mode alternative for developers who want letters, digits, symbols and emojis — not just circles.

## Features

- **Content modes**: typed character, random digit/letter/symbol, emoji, or shape
- **Color modes**: fixed, palette, gradient, animated rainbow
- **5 presets**: Matrix, Fireworks, Typewriter, Rainbow Code, Minimal
- **Physics**: gravity, speed, spread, lifetime — all adjustable
- **Effects**: glow, explode, trail, 3D rotation
- **Combo system**: fast typing ramps particle count
- **Live settings panel** with visual controls
- **Auto-update check** on startup

## Presets

| Preset | Content | Color | Feel |
|--------|---------|-------|------|
| Matrix | Symbols | Green fixed | Falling code rain |
| Fireworks | Emojis | Rainbow | Bursting upward |
| Typewriter | Typed chars | Warm gold | Classic mechanical |
| Rainbow Code | Typed chars | Animated rainbow | Colorful spin |
| Minimal | Shapes | Grey | Subtle, barely there |

## Commands

| Command | Keybinding |
|---------|-----------|
| Toggle Effects | `Ctrl+Shift+I` |
| Open Settings Panel | Command Palette |
| Check for Updates | Command Palette |

## Settings

All settings are configurable via the Settings panel or VS Code settings (`imlec-typer.*`):

- `enabled` — master switch
- `preset` — choose from 5 built-in presets
- `contentMode` — what spawns: glyph / digit / letter / symbol / emoji / shape
- `colorMode` — fixed / palette / gradient / rainbow
- `count`, `size`, `gravity`, `speed`, `spreadDeg`, `lifetimeMs` — physics
- `glow`, `explode`, `trail`, `rotate3d` — visual effects
- `comboEnabled`, `comboMaxMultiplier` — combo ramp

## Building .vsix

```bash
cd editors/vscode
npm install
npm run compile
npm run package
# produces imlec-typer-0.1.0.vsix
```

Install: `code --install-extension imlec-typer-0.1.0.vsix`

## License

MIT
