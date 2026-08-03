use crate::color::ColorMode;
use crate::shape::Shape;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

// ────────────────────────────────────────────
// NEW: ParticleContent — what a particle displays
// ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ParticleContent {
    /// Geometric shape (original imlec behaviour)
    Shape(Shape),
    /// The actual character that was typed (editor-exclusive)
    Glyph,
    /// Random digit 0-9
    RandomDigit,
    /// Random letter a-zA-Z
    RandomLetter,
    /// Random symbol from a preset set
    RandomSymbol,
    /// Random emoji from a preset set
    Emoji(Vec<String>),
}

impl Default for ParticleContent {
    fn default() -> Self {
        ParticleContent::Shape(Shape::Circle)
    }
}

// ────────────────────────────────────────────
// NEW: Effects — CSS/visual effects (editor-only)
// ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Effects {
    pub glow: bool,
    pub explode: bool,
    pub trail: bool,
    pub rotate_3d: bool,
}

impl Default for Effects {
    fn default() -> Self {
        Self {
            glow: true,
            explode: true,
            trail: false,
            rotate_3d: false,
        }
    }
}

// ────────────────────────────────────────────
// NEW: Preset — named configuration bundle
// ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Preset {
    pub name: String,
    pub content_mode: String,
    #[serde(flatten)]
    pub emitter: Emitter,
}

// ────────────────────────────────────────────
// Config structs
// ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Config {
    pub general: General,
    pub typing: Emitter,
    pub deleting: Emitter,
    #[serde(default)]
    pub preset: HashMap<String, Preset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct General {
    pub enabled: bool,
    pub fps: u32,
    pub max_particles: usize,
    pub cursor_height_px: f32,
    pub offset_x: f32,
    pub offset_y: f32,
    pub combo_enabled: bool,
    pub combo_window_ms: u64,
    pub combo_max_multiplier: f32,
    pub min_emit_interval_ms: u64,
    #[serde(default = "default_fallback_content")]
    pub fallback_content: String,
}

fn default_fallback_content() -> String {
    "shape".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Emitter {
    pub enabled: bool,
    pub count: u32,
    pub shape: Shape,
    pub color: ColorMode,
    pub size_ratio: f32,
    pub size_jitter: f32,
    pub lifetime_ms: u64,
    pub lifetime_jitter: f32,
    pub speed: f32,
    pub speed_jitter: f32,
    pub direction_deg: f32,
    pub spread_deg: f32,
    pub gravity: f32,
    pub drag: f32,
    pub rotation_speed: f32,
    pub shrink: bool,
    #[serde(default)]
    pub content: ParticleContent,
    #[serde(default)]
    pub effects: Effects,
    #[serde(default = "default_emoji_set")]
    pub emoji_set: Vec<String>,
    #[serde(default = "default_symbol_set")]
    pub symbol_set: Vec<String>,
}

fn default_emoji_set() -> Vec<String> {
    vec![
        "🔥".to_string(),
        "💥".to_string(),
        "✨".to_string(),
        "⚡".to_string(),
        "🎯".to_string(),
        "💻".to_string(),
        "🚀".to_string(),
        "⭐".to_string(),
    ]
}

fn default_symbol_set() -> Vec<String> {
    vec![
        "{".to_string(),
        "}".to_string(),
        ";".to_string(),
        "/".to_string(),
        "<".to_string(),
        ">".to_string(),
        "=".to_string(),
        "+".to_string(),
        "-".to_string(),
        "*".to_string(),
        "&".to_string(),
        "|".to_string(),
        "!".to_string(),
        "?".to_string(),
    ]
}

impl Default for General {
    fn default() -> Self {
        Self {
            enabled: true,
            fps: 60,
            max_particles: 600,
            cursor_height_px: 20.0,
            offset_x: 0.0,
            offset_y: 0.0,
            combo_enabled: true,
            combo_window_ms: 600,
            combo_max_multiplier: 2.5,
            min_emit_interval_ms: 16,
            fallback_content: default_fallback_content(),
        }
    }
}

impl Default for Emitter {
    fn default() -> Self {
        Self {
            enabled: true,
            count: 6,
            shape: Shape::Circle,
            color: ColorMode::default(),
            size_ratio: 0.5,
            size_jitter: 0.4,
            lifetime_ms: 500,
            lifetime_jitter: 0.3,
            speed: 130.0,
            speed_jitter: 0.6,
            direction_deg: -90.0,
            spread_deg: 140.0,
            gravity: 320.0,
            drag: 1.8,
            rotation_speed: 3.0,
            shrink: true,
            content: ParticleContent::default(),
            effects: Effects::default(),
            emoji_set: default_emoji_set(),
            symbol_set: default_symbol_set(),
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        let mut presets = HashMap::new();
        presets.insert(
            "matrix".to_string(),
            Preset {
                name: "Matrix".to_string(),
                content_mode: "random_symbol".to_string(),
                emitter: Emitter {
                    color: ColorMode::Fixed { color: "#00ff41".into() },
                    gravity: 80.0,
                    drag: 0.5,
                    speed: 60.0,
                    content: ParticleContent::RandomSymbol,
                    ..Emitter::default()
                },
            },
        );
        presets.insert(
            "fireworks".to_string(),
            Preset {
                name: "Fireworks".to_string(),
                content_mode: "emoji".to_string(),
                emitter: Emitter {
                    count: 10,
                    gravity: -40.0,
                    spread_deg: 360.0,
                    speed: 100.0,
                    content: ParticleContent::Emoji(vec![
                        "🎆".to_string(),
                        "✨".to_string(),
                        "⭐".to_string(),
                    ]),
                    ..Emitter::default()
                },
            },
        );
        presets.insert(
            "typewriter".to_string(),
            Preset {
                name: "Typewriter".to_string(),
                content_mode: "glyph".to_string(),
                emitter: Emitter {
                    color: ColorMode::Fixed { color: "#d4a373".into() },
                    size_ratio: 0.7,
                    gravity: 250.0,
                    lifetime_ms: 400,
                    content: ParticleContent::Glyph,
                    ..Emitter::default()
                },
            },
        );
        presets.insert(
            "minimal".to_string(),
            Preset {
                name: "Minimal".to_string(),
                content_mode: "shape".to_string(),
                emitter: Emitter {
                    count: 3,
                    shape: Shape::Circle,
                    color: ColorMode::Fixed { color: "#888888".into() },
                    gravity: 400.0,
                    lifetime_ms: 300,
                    ..Emitter::default()
                },
            },
        );

        Self {
            general: General::default(),
            typing: Emitter::default(),
            deleting: Emitter {
                count: 8,
                shape: Shape::Spark,
                color: ColorMode::Fixed { color: "#ff3b30".into() },
                speed: 90.0,
                direction_deg: 90.0,
                spread_deg: 360.0,
                gravity: -60.0,
                lifetime_ms: 340,
                content: ParticleContent::Emoji(vec![
                    "💨".to_string(),
                    "❌".to_string(),
                    "🗑️".to_string(),
                ]),
                ..Emitter::default()
            },
            preset: presets,
        }
    }
}

impl Config {
    pub fn config_path() -> Result<PathBuf> {
        let dirs = directories::ProjectDirs::from("", "", "particle-cursor")
            .context("no valid home directory")?;
        Ok(dirs.config_dir().join("config.toml"))
    }

    pub fn load_or_init() -> Result<Self> {
        let path = Self::config_path()?;
        if !path.exists() {
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::write(&path, DEFAULT_TOML)?;
            return Ok(Self::default());
        }
        Self::load_from(&path)
    }

    pub fn load_from(path: &Path) -> Result<Self> {
        let text =
            std::fs::read_to_string(path).with_context(|| format!("reading {}", path.display()))?;
        let cfg: Config =
            toml::from_str(&text).with_context(|| format!("parsing {}", path.display()))?;
        Ok(cfg.validated())
    }

    pub fn validated(mut self) -> Self {
        self.general.fps = self.general.fps.clamp(15, 240);
        self.general.max_particles = self.general.max_particles.clamp(1, 20_000);
        self.general.cursor_height_px = self.general.cursor_height_px.clamp(1.0, 500.0);
        self.general.combo_max_multiplier = self.general.combo_max_multiplier.clamp(1.0, 20.0);
        for e in [&mut self.typing, &mut self.deleting] {
            e.count = e.count.clamp(0, 500);
            e.size_ratio = e.size_ratio.clamp(0.01, 20.0);
            e.size_jitter = e.size_jitter.clamp(0.0, 1.0);
            e.lifetime_ms = e.lifetime_ms.clamp(16, 10_000);
            e.lifetime_jitter = e.lifetime_jitter.clamp(0.0, 1.0);
            e.speed_jitter = e.speed_jitter.clamp(0.0, 1.0);
            e.spread_deg = e.spread_deg.clamp(0.0, 360.0);
            e.drag = e.drag.clamp(0.0, 20.0);
        }
        self
    }
}

pub const DEFAULT_TOML: &str = include_str!("../../../config/default.toml");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_has_default_presets() {
        let cfg = Config::default();
        assert!(cfg.preset.contains_key("matrix"));
        assert!(cfg.preset.contains_key("fireworks"));
        assert!(cfg.preset.contains_key("typewriter"));
        assert!(cfg.preset.contains_key("minimal"));
    }

    #[test]
    fn emitter_default_content_is_shape() {
        let e = Emitter::default();
        matches!(e.content, ParticleContent::Shape(_));
    }

    #[test]
    fn general_has_fallback_content() {
        let g = General::default();
        assert_eq!(g.fallback_content, "shape");
    }

    #[test]
    fn effects_default_values() {
        let fx = Effects::default();
        assert!(fx.glow);
        assert!(fx.explode);
        assert!(!fx.trail);
        assert!(!fx.rotate_3d);
    }

    #[test]
    fn deleting_default_has_emoji_content() {
        let cfg = Config::default();
        matches!(cfg.deleting.content, ParticleContent::Emoji(_));
    }
}
