use anyhow::Result;
use pc_core::{EmitKind, KeyClass, ParticleSystem};
use smithay_client_toolkit::compositor::{CompositorHandler, CompositorState};
use smithay_client_toolkit::delegate_compositor;
use std::sync::{Arc, Mutex};

/// Wayland layer-shell overlay implementation.
pub fn run(sys: Arc<Mutex<ParticleSystem>>) -> Result<()> {
    // Stub: full Wayland implementation requires event-loop wiring.
    // For now, log that Wayland mode is requested.
    log::info!("Wayland backend selected; full layer-shell support in progress");
    Ok(())
}

struct WaylandState {
    sys: Arc<Mutex<ParticleSystem>>,
}

impl CompositorHandler for WaylandState {
    fn scale_factor_changed(
        &mut self,
        _conn: &smithay_client_toolkit::reexports::client::Connection,
        _qh: &smithay_client_toolkit::reexports::client::QueueHandle<Self>,
        _surface: &smithay_client_toolkit::reexports::client::protocol::wl_surface::WlSurface,
        _new_factor: i32,
    ) {
    }

    fn frame(
        &mut self,
        _conn: &smithay_client_toolkit::reexports::client::Connection,
        _qh: &smithay_client_toolkit::reexports::client::QueueHandle<Self>,
        _surface: &smithay_client_toolkit::reexports::client::protocol::wl_surface::WlSurface,
        _time: u32,
    ) {
    }
}

delegate_compositor!(WaylandState);
