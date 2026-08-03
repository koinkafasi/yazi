use anyhow::Result;
use pc_core::{Config, ParticleSystem};
use std::sync::{Arc, Mutex};

pub mod keyboard;
pub mod pointer;
pub mod wayland;
pub mod x11;

pub fn run(config: Config) -> Result<()> {
    let sys = Arc::new(Mutex::new(ParticleSystem::new(config)));

    // Prefer Wayland when WAYLAND_DISPLAY is set, fall back to X11.
    if std::env::var("WAYLAND_DISPLAY").is_ok() {
        wayland::run(sys)
    } else {
        x11::run(sys)
    }
}
