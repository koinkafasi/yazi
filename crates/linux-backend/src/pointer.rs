use pc_core::{PointerPos, PointerSource};

/// Reads pointer position from evdev mouse/touchpad devices.
pub struct EvdevPointer {
    x: f32,
    y: f32,
}

impl EvdevPointer {
    pub fn new() -> Self {
        Self { x: 0.0, y: 0.0 }
    }

    pub fn update(&mut self, dx: i32, dy: i32) {
        self.x += dx as f32;
        self.y += dy as f32;
    }
}

impl PointerSource for EvdevPointer {
    fn position(&mut self) -> Option<PointerPos> {
        Some(PointerPos {
            x: self.x,
            y: self.y,
        })
    }
}
