import * as vscode from 'vscode';
import { PRESETS, getPreset } from './presets';

let enabled = true;
let currentPreset = 'typewriter';
let panel: vscode.WebviewPanel | undefined;

interface ParticleConfig {
    contentMode: string;
    color: string | string[] | 'rainbow';
    count: number;
    gravity: number;
    speed: number;
    spreadDeg: number;
    lifetimeMs: number;
    glow: boolean;
    explode: boolean;
    emojiSet: string[];
    symbolSet: string[];
    size: number;
}

function getConfig(): ParticleConfig {
    const preset = getPreset(currentPreset) || getPreset('typewriter')!;
    return {
        contentMode: preset.contentMode,
        color: preset.color,
        count: preset.count,
        gravity: preset.gravity,
        speed: preset.speed,
        spreadDeg: preset.spreadDeg,
        lifetimeMs: preset.lifetimeMs,
        glow: preset.glow,
        explode: preset.explode,
        emojiSet: preset.emojiSet || ['🔥', '💥', '✨', '⚡', '🎯', '💻', '🚀', '⭐'],
        symbolSet: preset.symbolSet || ['{', '}', ';', '/', '<', '>', '=', '+', '-', '*', '&', '|', '!', '?'],
        size: 14,
    };
}

function getContent(config: ParticleConfig, typedChar: string): string {
    switch (config.contentMode) {
        case 'glyph': return typedChar;
        case 'random_digit': return Math.floor(Math.random() * 10).toString();
        case 'random_letter': {
            const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
            return letters[Math.floor(Math.random() * letters.length)];
        }
        case 'random_symbol': {
            const syms = config.symbolSet;
            return syms[Math.floor(Math.random() * syms.length)];
        }
        case 'emoji': {
            const emojis = config.emojiSet;
            return emojis[Math.floor(Math.random() * emojis.length)];
        }
        case 'shape':
        default: return '●';
    }
}

export function activate(context: vscode.ExtensionContext): void {
    const disposables: vscode.Disposable[] = [];

    panel = vscode.window.createWebviewPanel(
        'imlecOverlay',
        'imlec-typer',
        { viewColumn: vscode.ViewColumn.One, preserveFocus: true },
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [context.extensionUri],
        }
    );

    panel.webview.html = getOverlayHtml();
    panel.onDidDispose(() => { panel = undefined; });

    disposables.push(
        vscode.window.onDidChangeTextEditorSelection((event) => {
            if (!enabled || !panel || !event.textEditor) { return; }
            const editor = event.textEditor;
            const document = editor.document;
            const selection = editor.selection;
            if (event.kind === vscode.TextEditorSelectionChangeKind.Keyboard) {
                const pos = selection.active;
                const line = document.lineAt(pos.line);
                const char = pos.character > 0 && pos.character <= line.text.length
                    ? line.text[pos.character - 1] || ' '
                    : ' ';
                const cfg = getConfig();
                panel.webview.postMessage({
                    type: 'spawn',
                    char: getContent(cfg, char),
                    x: 300 + Math.random() * 200,
                    y: 200 + Math.random() * 100,
                    config: cfg,
                });
            }
        })
    );

    disposables.push(
        vscode.commands.registerCommand('imlec-typer.toggle', () => {
            enabled = !enabled;
            vscode.window.showInformationMessage(`imlec-typer ${enabled ? 'enabled' : 'disabled'}`);
        })
    );

    for (const key of Object.keys(PRESETS)) {
        disposables.push(
            vscode.commands.registerCommand(`imlec-typer.preset.${key}`, () => {
                const preset = getPreset(key);
                if (preset) {
                    currentPreset = key;
                    vscode.window.showInformationMessage(`imlec-typer preset: ${preset.name}`);
                }
            })
        );
    }

    context.subscriptions.push(...disposables);
}

export function deactivate(): void {
    if (panel) { panel.dispose(); }
}

function getOverlayHtml(): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
body { margin: 0; padding: 0; overflow: hidden; background: transparent; }
#particles { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
.imlec-particle { position: fixed; pointer-events: none; z-index: 999999; font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace; font-weight: bold; white-space: pre; will-change: transform, opacity; }
.imlec-particle.glow { text-shadow: 0 0 6px currentColor, 0 0 12px currentColor; }
</style>
</head>
<body>
<div id="particles"></div>
<script>
const particles = [];
let animFrame = null;
window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'spawn') spawn(msg.char, msg.x, msg.y, msg.config);
});
function spawn(text, x, y, cfg) {
    const el = document.createElement('span');
    el.className = 'imlec-particle' + (cfg.glow ? ' glow' : '');
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.color = Array.isArray(cfg.color) ? cfg.color[Math.floor(Math.random() * cfg.color.length)] : cfg.color === 'rainbow' ? 'hsl(' + (Math.random() * 360) + ', 80%, 60%)' : cfg.color;
    el.style.fontSize = cfg.size + 'px';
    document.getElementById('particles').appendChild(el);
    const dir = (-90 + (Math.random() - 0.5) * cfg.spreadDeg) * Math.PI / 180;
    const speed = cfg.speed * (0.7 + Math.random() * 0.6);
    particles.push({ el, x, y, vx: Math.cos(dir) * speed, vy: Math.sin(dir) * speed, life: cfg.lifetimeMs, maxLife: cfg.lifetimeMs, gravity: cfg.gravity });
    if (!animFrame) animFrame = requestAnimationFrame(update);
}
function update() {
    const dt = 16, dtSec = dt / 1000;
    const container = document.getElementById('particles');
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) { container.removeChild(p.el); particles.splice(i, 1); continue; }
        const drag = 0.02;
        p.vx *= 1 - drag;
        p.vy = p.vy * (1 - drag) + p.gravity * dtSec;
        p.x += p.vx * dtSec;
        p.y += p.vy * dtSec;
        const t = p.life / p.maxLife;
        p.el.style.left = p.x + 'px';
        p.el.style.top = p.y + 'px';
        p.el.style.opacity = t;
        p.el.style.transform = 'scale(' + Math.max(0.1, t) + ')';
    }
    if (particles.length > 0) animFrame = requestAnimationFrame(update); else animFrame = null;
}
</script>
</body>
</html>`;
}
