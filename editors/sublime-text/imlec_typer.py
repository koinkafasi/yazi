# imlec-typer — Sublime Text 4 Plugin
# Particle effects at your cursor while typing.
# Install: copy this file to Packages/User/imlec_typer.py

import sublime
import sublime_plugin
import random
import math

# ── Config ─────────────────────────────────────────────────

SETTINGS_FILE = "imlec-typer.sublime-settings"

PRESETS = {
    "matrix":      {"content": "symbol", "color": "#00ff41", "count": 4,  "gravity": 80,  "speed": 60,  "spread": 140},
    "fireworks":   {"content": "emoji",  "color": "rainbow", "count": 8,  "gravity": -40, "speed": 100, "spread": 360},
    "typewriter":  {"content": "glyph",  "color": "#d4a373", "count": 1,  "gravity": 250, "speed": 50,  "spread": 60},
    "rainbow":     {"content": "glyph",  "color": "rainbow", "count": 3,  "gravity": 150, "speed": 120, "spread": 180},
    "minimal":     {"content": "shape",  "color": "#888888", "count": 2,  "gravity": 400, "speed": 80,  "spread": 90},
}

SYMBOLS = ['{', '}', ';', '/', '<', '>', '=', '+', '-', '*', '&', '|', '!', '?']
EMOJIS  = ['🔥', '💥', '✨', '⚡', '🎯', '💻', '🚀', '⭐']
SHAPES  = ['●', '■', '▲', '◆', '★', '✦', '⬡']

# ── Particle Logic ─────────────────────────────────────────

class Particle:
    _id_counter = 0

    def __init__(self, view, text, x, y, cfg):
        Particle._id_counter += 1
        self.id = Particle._id_counter
        self.view = view
        self.text = text
        self.x = x
        self.y = y
        self.life = cfg.get("lifetime", 500)
        self.max_life = self.life
        self.gravity = cfg.get("gravity", 320)

        spread = math.radians(cfg.get("spread", 140))
        dir_angle = -math.pi / 2 + (random.random() - 0.5) * spread
        spd = cfg.get("speed", 130) * (0.7 + random.random() * 0.6)
        self.vx = math.cos(dir_angle) * spd
        self.vy = math.sin(dir_angle) * spd

        color = cfg.get("color", "#ff2d95")
        if color == "rainbow":
            color = "hsl({},80%,60%)".format(int(random.random() * 360))
        self.color = color
        self.size = cfg.get("size", 14)
        self.glow = cfg.get("glow", True)

    def update(self, dt):
        dt_s = dt / 1000.0
        drag = 0.02
        self.vx *= (1 - drag)
        self.vy = self.vy * (1 - drag) + self.gravity * dt_s
        self.x += self.vx * dt_s
        self.y += self.vy * dt_s
        self.life -= dt
        return self.life > 0

    @property
    def opacity(self):
        return max(0, self.life / self.max_life)


# ── Overlay Phantom ────────────────────────────────────────

class ImlecOverlay:
    def __init__(self):
        self.particles = []
        self.running = False
        self.phantom_set = None
        self._timer = None

    def spawn(self, view, text, cfg):
        sel = view.sel()
        if not sel:
            return
        pt = sel[0].b
        try:
            vx, vy = view.text_to_layout(pt)
        except Exception:
            return
        vx += view.viewport_position()[0]
        vy += view.viewport_position()[1]

        for _ in range(cfg.get("count", 6)):
            self.particles.append(Particle(view, text, vx, vy, cfg))

        if not self.running:
            self.running = True
            self._tick()

    def _tick(self):
        dt = 16
        alive = []
        for p in self.particles:
            if p.update(dt):
                alive.append(p)
        self.particles = alive

        views = {}
        for p in self.particles:
            vid = p.view.id()
            if vid not in views:
                views[vid] = []
            views[vid].append(p)

        for vid, pts in views.items():
            self._render_phantoms(pts)

        if self.particles:
            self._timer = sublime.set_timeout(self._tick, dt)
        else:
            self.running = False

    def _render_phantoms(self, particles):
        if not particles:
            return
        view = particles[0].view
        html_parts = []
        for p in particles:
            glow = "text-shadow:0 0 6px {},0 0 12px {};".format(p.color, p.color) if p.glow else ""
            html_parts.append(
                '<div style="position:absolute;left:{}px;top:{}px;'
                'color:{};font-size:{}px;font-weight:bold;opacity:{:.2f};'
                'font-family:monospace;pointer-events:none;z-index:999;white-space:pre;{}">{}</div>'
                .format(int(p.x), int(p.y), p.color, p.size, p.opacity, glow, p.text)
            )

        html = '<div style="position:relative;width:1px;height:1px;">{}</div>'.format("".join(html_parts))
        region = sublime.Region(0, 0)
        phantom = sublime.Phantom(region, html, sublime.LAYOUT_BLOCK)

        if self.phantom_set is None or self.phantom_set.view != view:
            self.phantom_set = sublime.PhantomSet(view, "imlec-typer")
        self.phantom_set.update([phantom])


_overlay = ImlecOverlay()


# ── Event Listener ─────────────────────────────────────────

class ImlecTyperListener(sublime_plugin.EventListener):
    def on_modified_async(self, view):
        settings = sublime.load_settings(SETTINGS_FILE)
        if not settings.get("enabled", True):
            return

        preset_name = settings.get("preset", "typewriter")
        preset = PRESETS.get(preset_name, PRESETS["typewriter"])

        cfg = {
            "content": settings.get("content_mode", preset["content"]),
            "color": settings.get("color", preset["color"]),
            "count": settings.get("count", preset["count"]),
            "gravity": settings.get("gravity", preset["gravity"]),
            "speed": settings.get("speed", preset["speed"]),
            "spread": settings.get("spread_deg", preset["spread"]),
            "lifetime": settings.get("lifetime_ms", 500),
            "size": settings.get("size", 14),
            "glow": settings.get("glow", True),
        }

        content_mode = cfg["content"]
        if content_mode == "glyph":
            text = "●"
        elif content_mode == "random_digit":
            text = str(random.randint(0, 9))
        elif content_mode == "random_letter":
            text = random.choice("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")
        elif content_mode == "random_symbol":
            text = random.choice(SYMBOLS)
        elif content_mode == "emoji":
            text = random.choice(EMOJIS)
        else:
            text = random.choice(SHAPES)

        _overlay.spawn(view, text, cfg)


# ── Commands ───────────────────────────────────────────────

class ImlecTyperToggleCommand(sublime_plugin.ApplicationCommand):
    def run(self):
        s = sublime.load_settings(SETTINGS_FILE)
        s.set("enabled", not s.get("enabled", True))
        sublime.save_settings(SETTINGS_FILE)
        state = "enabled" if s.get("enabled") else "disabled"
        sublime.status_message("imlec-typer {}".format(state))


class ImlecTyperPresetCommand(sublime_plugin.ApplicationCommand):
    def run(self, preset="typewriter"):
        s = sublime.load_settings(SETTINGS_FILE)
        s.set("preset", preset)
        sublime.save_settings(SETTINGS_FILE)
        sublime.status_message("imlec-typer preset: {}".format(preset))


class ImlecTyperSettingsCommand(sublime_plugin.ApplicationCommand):
    def run(self):
        sublime.run_command("open_file", {
            "file": "${packages}/User/{}".format(SETTINGS_FILE)
        })
