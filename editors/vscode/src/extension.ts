import * as vscode from 'vscode';
import { PRESETS, getPreset } from './presets';

let enabled = true;
let currentPreset = 'typewriter';
let panel: vscode.WebviewPanel | undefined;
let statusBarItem: vscode.StatusBarItem;
let lastCheck = 0;

const REPO = 'koinkafasi/yazi';
const EXT_VERSION = '0.1.0';

export interface ParticleConfig {
    contentMode: string;
    color: string | string[] | 'rainbow';
    count: number;
    gravity: number;
    speed: number;
    spreadDeg: number;
    lifetimeMs: number;
    glow: boolean;
    explode: boolean;
    trail: boolean;
    rotate3d: boolean;
    emojiSet: string[];
    symbolSet: string[];
    size: number;
    comboEnabled: boolean;
    comboMaxMultiplier: number;
}

function loadConfigFromSettings(): ParticleConfig {
    const cfg = vscode.workspace.getConfiguration('imlec-typer');
    const presetName = cfg.get<string>('preset', 'typewriter');
    const preset = getPreset(presetName);

    const colorMode = cfg.get<string>('colorMode', preset?.contentMode || 'palette');
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
        gravity: cfg.get<number>('gravity', preset?.gravity || 320),
        speed: cfg.get<number>('speed', preset?.speed || 130),
        spreadDeg: cfg.get<number>('spreadDeg', preset?.spreadDeg || 140),
        lifetimeMs: cfg.get<number>('lifetimeMs', preset?.lifetimeMs || 500),
        glow: cfg.get<boolean>('glow', preset?.glow ?? true),
        explode: cfg.get<boolean>('explode', preset?.explode ?? true),
        trail: cfg.get<boolean>('trail', false),
        rotate3d: cfg.get<boolean>('rotate3d', false),
        emojiSet: cfg.get<string[]>('emojiSet', ['🔥', '💥', '✨', '⚡', '🎯', '💻', '🚀', '⭐']),
        symbolSet: cfg.get<string[]>('symbolSet', ['{', '}', ';', '/', '<', '>', '=', '+', '-', '*', '&', '|', '!', '?']),
        size: cfg.get<number>('size', 14),
        comboEnabled: cfg.get<boolean>('comboEnabled', true),
        comboMaxMultiplier: cfg.get<number>('comboMaxMultiplier', 2.5),
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
        default: {
            const shapes = ['●', '■', '▲', '◆', '★', '✦', '⬡'];
            return shapes[Math.floor(Math.random() * shapes.length)];
        }
    }
}

function updateStatusBar() {
    if (!statusBarItem) return;
    statusBarItem.text = enabled ? `$(play) imlec: ${currentPreset}` : `$(debug-pause) imlec: off`;
    statusBarItem.tooltip = enabled
        ? `imlec-typer active — preset: ${currentPreset}\nClick to toggle`
        : 'imlec-typer paused — Click to enable';
}

async function checkForUpdates(silent = true) {
    const now = Date.now();
    if (now - lastCheck < 24 * 60 * 60 * 1000) return;
    lastCheck = now;

    try {
        const resp = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
        const data = await resp.json();
        const latest = (data.tag_name || '').replace(/^v/, '');
        if (!latest) return;

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
    const pa = a.split(/[.-]/).map(x => parseInt(x) || 0);
    const pb = b.split(/[.-]/).map(x => parseInt(x) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff !== 0) return diff > 0;
    }
    return false;
}

function openSettingsPanel(context: vscode.ExtensionContext) {
    if (panel) {
        panel.reveal(vscode.ViewColumn.Beside);
        return;
    }

    panel = vscode.window.createWebviewPanel(
        'imlecSettings',
        'imlec-typer Settings',
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        { enableScripts: true, retainContextWhenHidden: true }
    );

    panel.webview.html = getSettingsHtml();

    panel.webview.onDidReceiveMessage(async (msg) => {
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
            case 'setGravity':
                await cfg.update('gravity', msg.value, true);
                break;
            case 'setSpeed':
                await cfg.update('speed', msg.value, true);
                break;
            case 'setSpread':
                await cfg.update('spreadDeg', msg.value, true);
                break;
            case 'setLifetime':
                await cfg.update('lifetimeMs', msg.value, true);
                break;
            case 'setSize':
                await cfg.update('size', msg.value, true);
                break;
            case 'setGlow':
                await cfg.update('glow', msg.value, true);
                break;
            case 'setExplode':
                await cfg.update('explode', msg.value, true);
                break;
            case 'setTrail':
                await cfg.update('trail', msg.value, true);
                break;
            case 'setRotate3d':
                await cfg.update('rotate3d', msg.value, true);
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

    panel.onDidDispose(() => { panel = undefined; });
}

export function activate(context: vscode.ExtensionContext): void {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'imlec-typer.toggle';
    updateStatusBar();
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    const cfg = vscode.workspace.getConfiguration('imlec-typer');
    enabled = cfg.get<boolean>('enabled', true);
    currentPreset = cfg.get<string>('preset', 'typewriter');
    updateStatusBar();

    if (cfg.get<boolean>('checkUpdates', true)) {
        checkForUpdates(true);
    }

    const overlay = vscode.window.createWebviewPanel(
        'imlecOverlay',
        'imlec-typer',
        { viewColumn: vscode.ViewColumn.One, preserveFocus: true },
        { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [context.extensionUri] }
    );
    overlay.webview.html = getOverlayHtml();
    overlay.onDidDispose(() => {});

    context.subscriptions.push(
        vscode.commands.registerCommand('imlec-typer.toggle', () => {
            enabled = !enabled;
            vscode.workspace.getConfiguration('imlec-typer').update('enabled', enabled, true);
            updateStatusBar();
            vscode.window.showInformationMessage(`imlec-typer ${enabled ? 'enabled' : 'disabled'}`);
        }),
        vscode.commands.registerCommand('imlec-typer.settings', () => {
            openSettingsPanel(context);
        }),
        vscode.commands.registerCommand('imlec-typer.checkUpdate', () => {
            checkForUpdates(false);
        })
    );

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

    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection((event) => {
            if (!enabled || !overlay || !event.textEditor) return;
            if (event.kind !== vscode.TextEditorSelectionChangeKind.Keyboard) return;

            const editor = event.textEditor;
            const document = editor.document;
            const selection = editor.selection;
            const pos = selection.active;
            const line = document.lineAt(pos.line);
            const char = pos.character > 0 && pos.character <= line.text.length
                ? line.text[pos.character - 1] || ' '
                : ' ';

            const config = loadConfigFromSettings();
            overlay.webview.postMessage({
                type: 'spawn',
                char: getContent(config, char),
                config,
            });
        })
    );

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
    if (panel) panel.dispose();
}

function getOverlayHtml(): string {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
body{margin:0;padding:0;overflow:hidden;background:transparent}
#p{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none}
.imlec{position:fixed;pointer-events:none;z-index:999999;font-family:'JetBrains Mono','Fira Code','Cascadia Code',monospace;font-weight:bold;white-space:pre;will-change:transform,opacity}
.imlec.glow{text-shadow:0 0 6px currentColor,0 0 12px currentColor}
.imlec.trail{filter:blur(0.5px)}
</style>
</head><body><div id="p"></div>
<script>
const pts=[];let af=null;
window.addEventListener('message',e=>{const m=e.data;if(m.type==='spawn')spawn(m.char,m.config)});
function spawn(text,cfg){
    const el=document.createElement('span');
    el.className='imlec'+(cfg.glow?' glow':'')+(cfg.trail?' trail':'');
    el.textContent=text;
    const vw=window.innerWidth,vh=window.innerHeight;
    const x=vw*0.3+Math.random()*vw*0.4,y=vh*0.2+Math.random()*vh*0.4;
    el.style.left=x+'px';el.style.top=y+'px';
    let col;
    if(Array.isArray(cfg.color))col=cfg.color[Math.floor(Math.random()*cfg.color.length)];
    else if(cfg.color==='rainbow')col='hsl('+Math.random()*360+',80%,60%)';
    else if(Array.isArray(cfg.color)&&cfg.color.length===2){
        const t=Math.random();col=interp(cfg.color[0],cfg.color[1],t);
    }else col=cfg.color;
    el.style.color=col;el.style.fontSize=cfg.size+'px';
    if(cfg.rotate3d)el.style.transform='perspective(200px) rotateX('+(Math.random()*40-20)+'deg) rotateY('+(Math.random()*40-20)+'deg)';
    document.getElementById('p').appendChild(el);
    const dir=(-90+(Math.random()-0.5)*cfg.spreadDeg)*Math.PI/180;
    const spd=cfg.speed*(0.7+Math.random()*0.6);
    pts.push({el,x,y,vx:Math.cos(dir)*spd,vy:Math.sin(dir)*spd,life:cfg.lifetimeMs,maxLife:cfg.lifetimeMs,gravity:cfg.gravity,rotate3d:cfg.rotate3d});
    if(!af)af=requestAnimationFrame(upd);
}
function interp(a,b,t){
    const h=i=>[parseInt(i.slice(1,3),16),parseInt(i.slice(3,5),16),parseInt(i.slice(5,7),16)];
    const [r1,g1,b1]=h(a),[r2,g2,b2]=h(b);
    const f=v=>Math.round(v1+t*(v2-v1)).toString(16).padStart(2,'0');
    return '#'+f(r1)+f(g1)+f(b1);
}
function upd(){
    const dt=16,dtS=dt/1000,c=document.getElementById('p');
    for(let i=pts.length-1;i>=0;i--){
        const p=pts[i];p.life-=dt;
        if(p.life<=0){c.removeChild(p.el);pts.splice(i,1);continue;}
        const drag=0.02;p.vx*=1-drag;p.vy=p.vy*(1-drag)+p.gravity*dtS;
        p.x+=p.vx*dtS;p.y+=p.vy*dtS;
        const t=p.life/p.maxLife;
        p.el.style.left=p.x+'px';p.el.style.top=p.y+'px';
        p.el.style.opacity=t;
        const s=Math.max(0.1,t);
        if(p.rotate3d)p.el.style.transform='perspective(200px) rotateX('+(Math.random()*10-5)+'deg) rotateY('+(Math.random()*10-5)+'deg) scale('+s+')';
        else p.el.style.transform='scale('+s+')';
    }
    pts.length>0?(af=requestAnimationFrame(upd)):(af=null);
}
</script></body></html>`;
}

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
.row select,.row input[type="number"]{background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:4px;padding:4px 8px}
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
${Object.entries(PRESETS).map(([k,v])=>`<button class="preset-btn" data-preset="${k}" onclick="setPreset('${k}')">${v.name}</button>`).join('')}
</div>
</div>
<div class="group">
<h3>🎨 Content & Color</h3>
<div class="row"><label>Content Mode</label><select id="contentMode" onchange="send('setContentMode',this.value)">
<option value="glyph">Glyph (typed char)</option><option value="random_digit">Random Digit</option>
<option value="random_letter">Random Letter</option><option value="random_symbol">Random Symbol</option>
<option value="emoji">Emoji</option><option value="shape">Shape</option>
</select></div>
<div class="row"><label>Color Mode</label><select id="colorMode" onchange="send('setColorMode',this.value)">
<option value="fixed">Fixed</option><option value="palette">Palette</option>
<option value="gradient">Gradient</option><option value="rainbow">Rainbow</option>
</select></div>
</div>
<div class="group">
<h3>⚙️ Physics</h3>
<div class="row"><label>Count</label><input type="range" min="1" max="50" oninput="setNum('setCount',this.value)"><span class="val">6</span></div>
<div class="row"><label>Size (px)</label><input type="range" min="8" max="48" oninput="setNum('setSize',this.value)"><span class="val">14</span></div>
<div class="row"><label>Gravity</label><input type="range" min="-1000" max="1000" oninput="setNum('setGravity',this.value)"><span class="val">320</span></div>
<div class="row"><label>Speed</label><input type="range" min="0" max="1000" oninput="setNum('setSpeed',this.value)"><span class="val">130</span></div>
<div class="row"><label>Spread °</label><input type="range" min="0" max="360" oninput="setNum('setSpread',this.value)"><span class="val">140</span></div>
<div class="row"><label>Lifetime ms</label><input type="range" min="100" max="3000" oninput="setNum('setLifetime',this.value)"><span class="val">500</span></div>
</div>
<div class="group">
<h3>✨ Effects</h3>
<div class="row"><label>Glow</label><input type="checkbox" onchange="send('setGlow',this.checked)"></div>
<div class="row"><label>Explode</label><input type="checkbox" onchange="send('setExplode',this.checked)"></div>
<div class="row"><label>Trail</label><input type="checkbox" onchange="send('setTrail',this.checked)"></div>
<div class="row"><label>3D Rotate</label><input type="checkbox" onchange="send('setRotate3d',this.checked)"></div>
<div class="row"><label>Combo Mode</label><input type="checkbox" onchange="send('setCombo',this.checked)"></div>
</div>
<div style="text-align:center;margin-top:20px">
<button onclick="send('toggle')">Toggle On/Off</button>
</div>
<script>
const vscode=acquireVsCodeApi();
function send(cmd,val){vscode.postMessage({type:cmd,value:val})}
function setNum(cmd,val){send(cmd,parseInt(val))}
function setPreset(name){document.querySelectorAll('.preset-btn').forEach(b=>b.classList.toggle('active',b.dataset.preset===name));send('setPreset',name)}
</script>
</body></html>`;
}
