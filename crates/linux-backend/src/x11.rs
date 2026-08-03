use anyhow::Result;
use pc_core::{EmitKind, KeyClass, ParticleSystem};
use std::sync::{Arc, Mutex};
use x11rb::connection::Connection;
use x11rb::protocol::xproto::{ChangeWindowAttributesRequest, EventMask, Window};
use x11rb::rust_connection::RustConnection;

/// X11 overlay implementation using a shaped, override-redirect window.
pub fn run(sys: Arc<Mutex<ParticleSystem>>) -> Result<()> {
    let (conn, screen_num) = RustConnection::connect(None)?;
    let screen = &conn.setup().roots[screen_num];
    let root = screen.root;

    log::info!("X11 backend active on root window {}", root);

    // TODO: create override-redirect window, shape it, render particles.
    // Stub for compilation.
    loop {
        std::thread::sleep(std::time::Duration::from_secs(1));
    }
}
