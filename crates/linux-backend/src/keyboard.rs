use anyhow::{Context, Result};
use evdev::{Device, EventType, InputEvent, Key};
use pc_core::KeyClass;
use std::path::Path;

/// Reads from /dev/input/event* devices and classifies keys.
pub struct KeyboardReader {
    device: Device,
}

impl KeyboardReader {
    pub fn open(path: &Path) -> Result<Self> {
        let device = Device::open(path).with_context(|| format!("opening {path:?}"))?;
        Ok(Self { device })
    }

    pub fn next_event(&mut self) -> Result<Option<KeyClass>> {
        for ev in self.device.fetch_events()? {
            if ev.event_type() == EventType::KEY && ev.value() == 1 {
                return Ok(Some(classify_key(ev.code())));
            }
        }
        Ok(None)
    }
}

fn classify_key(code: u16) -> KeyClass {
    match Key::new(code) {
        Some(Key::KEY_BACKSPACE) | Some(Key::KEY_DELETE) => KeyClass::Delete,
        Some(Key::KEY_LEFTSHIFT)
        | Some(Key::KEY_RIGHTSHIFT)
        | Some(Key::KEY_LEFTCTRL)
        | Some(Key::KEY_RIGHTCTRL)
        | Some(Key::KEY_LEFTMETA)
        | Some(Key::KEY_RIGHTMETA)
        | Some(Key::KEY_LEFTALT)
        | Some(Key::KEY_RIGHTALT)
        | Some(Key::KEY_CAPSLOCK)
        | Some(Key::KEY_NUMLOCK)
        | Some(Key::KEY_SCROLLLOCK) => KeyClass::Ignore,
        Some(Key::KEY_LEFT)
        | Some(Key::KEY_RIGHT)
        | Some(Key::KEY_UP)
        | Some(Key::KEY_DOWN)
        | Some(Key::KEY_HOME)
        | Some(Key::KEY_END)
        | Some(Key::KEY_PAGEUP)
        | Some(KEY_PAGEDOWN)
        | Some(Key::KEY_INSERT)
        | Some(Key::KEY_ESC) => KeyClass::Ignore,
        _ => KeyClass::Text,
    }
}

use evdev::Key as EvdevKey;
const KEY_PAGEDOWN: EvdevKey = EvdevKey::KEY_PAGEDOWN;
