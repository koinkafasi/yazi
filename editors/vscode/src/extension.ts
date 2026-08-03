import * as vscode from 'vscode';
import { PRESETS, getPreset } from './presets';

let enabled = true;
let currentPreset = 'typewriter';
let settingsPanel: vscode.WebviewPanel | undefined;
let statusBarItem: vscode.StatusBarItem;
let lastCheck = 0;

const REPO = 'koinkafasi/yazi';
const EXT_VERSION = '0.1.0';

/* ── Types ─────────────────────────────────────────────── */

export interface ParticleConfig {
    contentMode: string;
    color: string | string[] | 'rainbow';
    count: number;
    lifetimeMs: number;
    glow: boolean;
    explode: boolean;
    emojiSet: string[];
    symbolSet: string[];
    comboEnabled: boolean;
    comboMaxMultiplier: number;
}

type EventKind = 'insert' | 'delete' | 'tab' | 'enter' | 'space';

interface ActiveDecoration {
    decoration: vscode.TextEditorDecorationType;
    timeout: NodeJS.Timeout;
}

/* ── Config ────────────────────────────────────────────── */

function loadConfig(): ParticleConfig {
    const cfg = vscode.workspace.getConfiguration('imlec-typer');
    const presetName = cfg.get<string>('preset', 'typewriter');
    const preset = getPreset(presetName);

    const colorMode = cfg.get<string>('colorMode', 'palette');
    let color: string | string[] | 'rainbow' = '#ff2d95';
    if (colorMode === 'fixed') {
        color = cfg.get<string>('colorFixed', '#ff2d95');
    } else if (colorMode === 'palette') {
        color = cfg.get<string[]>('colorPalette', ['#ff2d95', '#ff9f1c', '#2de2e6', '#a06cff', '#f9f871']);
    } else if (colorMode === 'gradient') {
        color = [cfg.get<string>('colorGradientFrom', '#ff2d95'), cfg.get<string>('colorGradientTo', '#2de2e6')];
    } else if (colorMode === 'rainbow') {
        color = 'rainbow';
    }

    return {
        contentMode: cfg.get<string>('contentMode', preset?.contentMode || 'glyph'),
        color,
        count: cfg.get<number>('count', preset?.count || 6),
        lifetimeMs: cfg.get<number>('lifetimeMs', preset?.lifetimeMs || 500),
        glow: cfg.get<boolean>('glow', preset?.glow ?? true),
        explode: cfg.get<boolean>('explode', preset?.explode ?? true),
        emojiSet: cfg.get<string[]>('emojiSet', ['🔥', '💥', '✨', '⚡', '🎯', '💻', '🚀', '⭐']),
        symbolSet: cfg.get<string[]>('symbolSet', ['{', '}', ';', '/', '<', '>', '=', '+', '-', '*', '&', '|', '!', '?']),
        comboEnabled: cfg.get<boolean>('comboEnabled', true),
        comboMaxMultiplier: cfg.get<number>('comboMaxMultiplier', 2.5),
    };
}

/* ── Content generators ────────────────────────────────── */

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
        default: {
            const shapes = ['●', '■', '▲', '◆', '★', '✦', '⬡'];
            return shapes[Math.floor(Math.random() * shapes.length)];
        }
    }
}

function pickColor(config: ParticleConfig): string {
    if (config.color === 'rainbow') {
        return `hsl(${Math.floor(Math.random() * 360)}, 85%, 60%)`;
    }
    if (Array.isArray(config.color)) {
        if (config.color.length === 2) {
            const t = Math.random();
            return interpolateColor(config.color[0], config.color[1], t);
        }
        return config.color[Math.floor(Math.random() * config.color.length)];
    }
    return config.color;
}

function interpolateColor(a: string, b: string, t: number): string {
    const hex = (s: string) => parseInt(s.slice(1), 16);
    const r1 = (hex(a) >> 16) & 0xff, g1 = (hex(a) >> 8) & 0xff, b1 = hex(a) & 0xff;
    const r2 = (hex(b) >> 16) & 0xff, g2 = (hex(b) >> 8) & 0xff, b2 = hex(b) & 0xff;
    const f = (v1: number, v2: number) => Math.round(v1 + t * (v2 - v1));
    const toHex = (v: number) => v.toString(16).padStart(2, '0');
    return `#${toHex(f(r1, r2))}${toHex(f(g1, g2))}${toHex(f(b1, b2))}`;
}

/* ── Combo tracking ────────────────────────────────────── */

const comboWindow = 500;
let lastKeystroke = 0;
let comboStreak = 0;

function getComboMultiplier(config: ParticleConfig): number {
    if (!config.comboEnabled) { return 1; }
    const now = Date.now();
    if (now - lastKeystroke < comboWindow) {
        comboStreak++;
    } else {
        comboStreak = 1;
    }
    lastKeystroke = now;
    return Math.min(config.comboMaxMultiplier, 1 + (comboStreak / 10));
}

/* ── Decoration engine ─────────────────────────────────── */

const activeDecorations: ActiveDecoration[] = [];

function spawnBurst(
    editor: vscode.TextEditor,
    position: vscode.Position,
    config: ParticleConfig,
    kind: EventKind,
    typedChar: string,
) {
    const comboMul = getComboMultiplier(config);
    const baseCount = Math.max(2, Math.floor(config.count * (config.explode ? comboMul : 1)));

    // Determine palette by event kind
    let palette: string[];
    let useGlyph: boolean;
    switch (kind) {
        case 'delete':
            palette = ['#ff2d2d', '#ff6b6b', '#ff9f1c', '#ff4757'];
            useGlyph = false;
            break;
        case 'tab':
            palette = ['#2de2e6', '#00d2d3', '#48dbfb', '#0abde3'];
            useGlyph = false;
            break;
        case 'enter':
            palette = ['#00ff41', '#2ecc71', '#55efc4', '#26de81'];
            useGlyph = false;
            break;
        case 'space':
            palette = ['#a06cff', '#f368e0', '#ff9ff3', '#f9f871'];
            useGlyph = false;
            break;
        default:
            palette = Array.isArray(config.color) && config.color.length > 2
                ? config.color
                : (config.color === 'rainbow' ? [] : [config.color as string]);
            useGlyph = true;
            break;
    }

    const pick = (): string => {
        if (palette.length === 0) { return `hsl(${Math.floor(Math.random() * 360)}, 85%, 60%)`; }
        return palette[Math.floor(Math.random() * palette.length)];
    };

    const range = new vscode.Range(position, position);

    // ── Background pulse on the typed character itself ──
    if (kind === 'insert') {
        const pulseColor = pick();
        const bgDt = vscode.window.createTextEditorDecorationType({
            backgroundColor: `${pulseColor}33`, // 20% opacity hex
            borderRadius: '2px',
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
        });
        editor.setDecorations(bgDt, [range]);
        const bgTimeout = setTimeout(() => {
            bgDt.dispose();
            const idx = activeDecorations.findIndex(d => d.decoration === bgDt);
            if (idx !== -1) { activeDecorations.splice(idx, 1); }
        }, config.lifetimeMs * 0.6);
        activeDecorations.push({ decoration: bgDt, timeout: bgTimeout });
    }

    // ── Before-content particles ──
    for (let i = 0; i < Math.ceil(baseCount / 2); i++) {
        const color = pick();
        const content = useGlyph ? getContent(config, typedChar) : randomBurstChar(kind);
        const dt = vscode.window.createTextEditorDecorationType({
            before: {
                contentText: content,
                color: color,
                fontWeight: 'bold',
                textDecoration: config.glow
                    ? `none; text-shadow: 0 0 6px ${color}, 0 0 14px ${color};`
                    : 'none;',
                margin: '0 2px 0 0',
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
        });
        editor.setDecorations(dt, [range]);
        const timeout = setTimeout(() => {
            dt.dispose();
            const idx = activeDecorations.findIndex(d => d.decoration === dt);
            if (idx !== -1) { activeDecorations.splice(idx, 1); }
        }, config.lifetimeMs);
        activeDecorations.push({ decoration: dt, timeout });
    }

    // ── After-content particles ──
    for (let i = 0; i < Math.ceil(baseCount / 2); i++) {
        const color = pick();
        const content = useGlyph ? getContent(config, typedChar) : randomBurstChar(kind);
        const dt = vscode.window.createTextEditorDecorationType({
            after: {
                contentText: content,
                color: color,
                fontWeight: 'bold',
                textDecoration: config.glow
                    ? `none; text-shadow: 0 0 6px ${color}, 0 0 14px ${color};`
                    : 'none;',
                margin: '0 0 0 2px',
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
        });
        editor.setDecorations(dt, [range]);
        const timeout = setTimeout(() => {
            dt.dispose();
            const idx = activeDecorations.findIndex(d => d.decoration === dt);
            if (idx !== -1) { activeDecorations.splice(idx, 1); }
        }, config.lifetimeMs);
        activeDecorations.push({ decoration: dt, timeout });
    }
}

function randomBurstChar(kind: EventKind): string {
    switch (kind) {
        case 'delete':  return ['💨', '✖', '🗑', '❌', '💥'][Math.floor(Math.random() * 5)];
        case 'tab':     return ['→', '⇥', '↹', '➜', '⇢'][Math.floor(Math.random() * 5)];
        case 'enter':   return ['↵', '⏎', '↓', '↴', '⇓'][Math.floor(Math.random() * 5)];
        case 'space':   return ['·', '∙', '○', '◦', '∘'][Math.floor(Math.random() * 5)];
        default:        return '✦';
    }
}

function clearAllDecorations() {
    for (const ad of activeDecorations) {
        clearTimeout(ad.timeout);
        ad.decoration.dispose();
    }
    activeDecorations.length = 0;
}

/* ── Status bar ────────────────────────────────────────── */

function updateStatusBar() {
    if (!statusBarItem) { return; }
    statusBarItem.text = enabled
        ? `$(play) imlec: ${currentPreset}`
        : `$(debug-pause) imlec: off`;
    statusBarItem.tooltip = enabled
        ? `imlec-typer active — preset: ${currentPreset}\nClick to toggle`
        : 'imlec-typer paused — Click to enable';
}

/* ── Update check ──────────────────────────────────────── */

async function checkForUpdates(silent = true) {
    const now = Date.now();
    if (now - lastCheck < 24 * 60 * 60 * 1000) { return; }
    lastCheck = now;

    try {
        const resp = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
        const data = await resp.json() as any;
        const latest = (data.tag_name || '').replace(/^v/, '');
        if (!latest) { return; }

        if (isNewer(latest, EXT_VERSION)) {
            const action = await vscode.window.showInformationMessage(
                `imlec-typer ${latest} is available (you have ${EXT_VERSION}).`,
                'View Release', 'Dismiss'
            );
            if (action === 'View Release') {
                vscode.env.openExternal(vscode.Uri.parse(data.html_url));
            }
        } else if (!silent) {
            vscode.window.showInformationMessage(`imlec-typer is up to date (${EXT_VERSION}).`);
        }
    } catch {
        if (!silent) {
            vscode.window.showWarningMessage('Could not check for updates.');
        }
    }
}

function isNewer(a: string, b: string): boolean {
    const pa = a.split(/[.-]/).map(x => parseInt(x, 10) || 0);
    const pb = b.split(/[.-]/).map(x => parseInt(x, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff !== 0) { return diff > 0; }
    }
    return false;
}

/* ── Settings panel ────────────────────────────────────── */

function openSettingsPanel(context: vscode.ExtensionContext) {
    if (settingsPanel) {
        settingsPanel.reveal(vscode.ViewColumn.Beside);
        return;
    }

    settingsPanel = vscode.window.createWebviewPanel(
        'imlecSettings',
        'imlec-typer Settings',
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        { enableScripts: true, retainContextWhenHidden: true }
    );

    settingsPanel.webview.html = getSettingsHtml();

    settingsPanel.webview.onDidReceiveMessage(async (msg) => {
        const cfg = vscode.workspace.getConfiguration('imlec-typer');
        switch (msg.type) {
            case 'setPreset':
                await cfg.update('preset', msg.value, true);
                currentPreset = msg.value;
                updateStatusBar();
                break;
            case 'setContentMode':
                await cfg.update('contentMode', msg.value, true);
                break;
            case 'setColorMode':
                await cfg.update('colorMode', msg.value, true);
                break;
            case 'setCount':
                await cfg.update('count', msg.value, true);
                break;
            case 'setLifetime':
                await cfg.update('lifetimeMs', msg.value, true);
                break;
            case 'setGlow':
                await cfg.update('glow', msg.value, true);
                break;
            case 'setExplode':
                await cfg.update('explode', msg.value, true);
                break;
            case 'setCombo':
                await cfg.update('comboEnabled', msg.value, true);
                break;
            case 'toggle':
                enabled = !enabled;
                await cfg.update('enabled', enabled, true);
                updateStatusBar();
                break;
        }
    });

    settingsPanel.onDidDispose(() => { settingsPanel = undefined; });
}

/* ── Activation ────────────────────────────────────────── */

export function activate(context: vscode.ExtensionContext): void {
    // Status bar
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'imlec-typer.toggle';
    updateStatusBar();
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Load initial config
    const cfg = vscode.workspace.getConfiguration('imlec-typer');
    enabled = cfg.get<boolean>('enabled', true);
    currentPreset = cfg.get<string>('preset', 'typewriter');
    updateStatusBar();

    // Check for updates on startup
    if (cfg.get<boolean>('checkUpdates', true)) {
        checkForUpdates(true);
    }

    // Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('imlec-typer.toggle', () => {
            enabled = !enabled;
            vscode.workspace.getConfiguration('imlec-typer').update('enabled', enabled, true);
            updateStatusBar();
            if (!enabled) { clearAllDecorations(); }
            vscode.window.showInformationMessage(`imlec-typer ${enabled ? 'enabled' : 'disabled'}`);
        }),
        vscode.commands.registerCommand('imlec-typer.settings', () => {
            openSettingsPanel(context);
        }),
        vscode.commands.registerCommand('imlec-typer.checkUpdate', () => {
            checkForUpdates(false);
        })
    );

    // Preset commands
    for (const key of Object.keys(PRESETS)) {
        context.subscriptions.push(
            vscode.commands.registerCommand(`imlec-typer.preset.${key}`, () => {
                const preset = getPreset(key);
                if (preset) {
                    currentPreset = key;
                    vscode.workspace.getConfiguration('imlec-typer').update('preset', key, true);
                    updateStatusBar();
                    vscode.window.showInformationMessage(`imlec-typer preset: ${preset.name}`);
                }
            })
        );
    }

    // ── Keystroke, delete, tab, enter tracking ────────────
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (!enabled) { return; }

            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document !== event.document) { return; }

            const config = loadConfig();

            for (const change of event.contentChanges) {
                const text = change.text;
                const isDelete = text === '' && change.rangeLength > 0;
                const pos = editor.document.positionAt(change.rangeOffset);

                if (isDelete) {
                    // Deletion — spawn red burst at deletion point
                    spawnBurst(editor, pos, config, 'delete', '');
                    continue;
                }

                // Multi-char paste / auto-indent — skip
                if (text.length > 1) { continue; }

                const char = text;
                if (char === '\t') {
                    spawnBurst(editor, pos, config, 'tab', '\t');
                } else if (char === '\n' || char === '\r\n') {
                    spawnBurst(editor, pos, config, 'enter', '\n');
                } else if (char === ' ') {
                    spawnBurst(editor, pos, config, 'space', ' ');
                } else {
                    spawnBurst(editor, pos, config, 'insert', char);
                }
            }
        })
    );

    // Config change listener
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('imlec-typer')) {
                const c = vscode.workspace.getConfiguration('imlec-typer');
                enabled = c.get<boolean>('enabled', true);
                currentPreset = c.get<string>('preset', 'typewriter');
                updateStatusBar();
            }
        })
    );
}

export function deactivate(): void {
    if (settingsPanel) { settingsPanel.dispose(); }
    clearAllDecorations();
}

/* ── Settings Panel HTML ───────────────────────────────── */

function getSettingsHtml(): string {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
*{box-sizing:border-box;font-family:var(--vscode-font-family);color:var(--vscode-foreground)}
body{padding:20px;background:var(--vscode-editor-background)}
h2{margin-top:0;color:var(--vscode-textLink-foreground)}
.group{background:var(--vscode-inputValidation-infoBackground);border:1px solid var(--vscode-panel-border);border-radius:6px;padding:16px;margin-bottom:16px}
.group h3{margin-top:0;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:var(--vscode-descriptionForeground)}
.row{display:flex;align-items:center;gap:12px;margin:8px 0}
.row label{min-width:140px;font-size:13px}
.row input[type="range"]{flex:1}
.row select, .row input[type="color"], .row input[type="number"]{background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:4px;padding:4px 8px}
.row input[type="checkbox"]{width:18px;height:18px}
.val{min-width:40px;text-align:right;font-size:12px;font-family:monospace}
button{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:4px;padding:8px 16px;cursor:pointer;font-size:13px}
button:hover{background:var(--vscode-button-hoverBackground)}
.preset-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px}
.preset-btn{background:var(--vscode-dropdown-background);border:1px solid var(--vscode-panel-border);border-radius:4px;padding:8px;cursor:pointer;text-align:center;font-size:12px}
.preset-btn:hover{border-color:var(--vscode-focusBorder)}
.preset-btn.active{border-color:var(--vscode-textLink-foreground);background:var(--vscode-list-activeSelectionBackground)}
</style>
</head><body>
<h2>⚡ imlec-typer Settings</h2>

<div class="group">
<h3>🎯 Preset</h3>
<div class="preset-grid">
${Object.entries(PRESETS).map(([k, v]) => `<button class="preset-btn" data-preset="${k}" onclick="setPreset('${k}')">${v.name}</button>`).join('')}
</div>
</div>

<div class="group">
<h3>🎨 Content & Color</h3>
<div class="row"><label>Content Mode</label><select id="contentMode" onchange="send('setContentMode',this.value)">
<option value="glyph">Glyph (typed char)</option>
<option value="random_digit">Random Digit</option>
<option value="random_letter">Random Letter</option>
<option value="random_symbol">Random Symbol</option>
<option value="emoji">Emoji</option>
<option value="shape">Shape</option>
</select></div>
<div class="row"><label>Color Mode</label><select id="colorMode" onchange="send('setColorMode',this.value)">
<option value="fixed">Fixed</option>
<option value="palette">Palette</option>
<option value="gradient">Gradient</option>
<option value="rainbow">Rainbow</option>
</select></div>
</div>

<div class="group">
<h3>⚙️ Physics</h3>
<div class="row"><label>Count</label><input type="range" id="count" min="1" max="50" oninput="setNum('setCount',this.value)"><span class="val" id="v-count">6</span></div>
<div class="row"><label>Lifetime ms</label><input type="range" id="lifetime" min="100" max="3000" oninput="setNum('setLifetime',this.value)"><span class="val" id="v-lifetime">500</span></div>
</div>

<div class="group">
<h3>✨ Effects</h3>
<div class="row"><label>Glow</label><input type="checkbox" id="glow" onchange="send('setGlow',this.checked)"></div>
<div class="row"><label>Explode</label><input type="checkbox" id="explode" onchange="send('setExplode',this.checked)"></div>
<div class="row"><label>Combo Mode</label><input type="checkbox" id="combo" onchange="send('setCombo',this.checked)"></div>
</div>

<div style="text-align:center;margin-top:20px">
<button onclick="send('toggle')">Toggle On/Off</button>
</div>

<script>
const vscode=acquireVsCodeApi();
function send(cmd,val){vscode.postMessage({type:cmd,value:val})}
function setNum(cmd,val){send(cmd,parseInt(val));document.getElementById('v-'+cmd.replace(/set/,'').toLowerCase()).textContent=val}
function setPreset(name){
    document.querySelectorAll('.preset-btn').forEach(b=>b.classList.toggle('active',b.dataset.preset===name));
    send('setPreset',name);
}
</script>
</body></html>`;
}
