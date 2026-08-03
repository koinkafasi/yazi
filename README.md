# imlec-typer

Particle effects at your cursor while typing — letters, digits, emojis, shapes.

A fork of [imlec](https://github.com/koinkafasi/imlec) with editor-aware caret tracking and content-based particles.

## Features

- **Glyph mode**: Particles show the actual character you typed
- **Random digit/letter/symbol modes**: Spawn random characters
- **Emoji mode**: Spawn emojis on keypress
- **Shape mode**: Original imlec geometric shapes
- **Presets**: Matrix, Fireworks, Typewriter, Rainbow Code, Minimal
- **VS Code Extension**: Real caret-tracked particles inside the editor
- **Cross-platform**: Windows, Linux (Hyprland, X11)

## Install

### Arch Linux / Hyprland

```bash
curl -fsSL https://raw.githubusercontent.com/koinkafasi/yazi/main/install.sh | bash
```

Add to `~/.config/hypr/hyprland.conf`:
```
exec-once = ~/.local/bin/imlec-typer
```

### Windows

```powershell
irm https://raw.githubusercontent.com/koinkafasi/yazi/main/install.ps1 | iex
```

## License

MIT
