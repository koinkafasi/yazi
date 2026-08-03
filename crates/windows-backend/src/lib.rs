use anyhow::Result;
use pc_core::{Config, KeyClass, ParticleSystem, PointerPos, PointerSource, Rect};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::Graphics::Gdi::ValidateRect;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, VK_BACK, VK_CONTROL, VK_DELETE, VK_DOWN, VK_END, VK_ESCAPE, VK_HOME,
    VK_INSERT, VK_LEFT, VK_LWIN, VK_MENU, VK_NEXT, VK_PRIOR, VK_RETURN, VK_RIGHT, VK_RWIN,
    VK_SHIFT, VK_SPACE, VK_TAB, VK_UP,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetCursorPos, GetMessageW, SetWindowsHookExW,
    TranslateMessage, UnhookWindowsHookEx, HHOOK, KBDLLHOOKSTRUCT, MSG, WH_KEYBOARD_LL,
    WM_KEYDOWN, WM_SYSKEYDOWN,
};

pub mod layer;
pub mod tray;

pub fn run(config: Config) -> Result<()> {
    let sys = Arc::new(Mutex::new(ParticleSystem::new(config)));
    let (tx, rx) = channel::<KeyClass>();

    let hook = unsafe {
        SetWindowsHookExW(
            WH_KEYBOARD_LL,
            Some(keyboard_hook),
            None,
            0,
        )?
    };

    let sys_clone = sys.clone();
    std::thread::spawn(move || {
        let mut last = Instant::now();
        loop {
            let dt = last.elapsed().as_secs_f32();
            last = Instant::now();
            {
                let mut s = sys_clone.lock().unwrap();
                s.update(dt);
            }
            std::thread::sleep(Duration::from_millis(8));
        }
    });

    let sys_clone2 = sys.clone();
    std::thread::spawn(move || {
        let mut pointer = MousePointer;
        layer::run_overlay(sys_clone2, rx, &mut pointer);
    });

    let mut msg = MSG::default();
    unsafe {
        while GetMessageW(&mut msg, HWND(0), 0, 0).into() {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
        UnhookWindowsHookEx(hook)?;
    }
    Ok(())
}

extern "system" fn keyboard_hook(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 && (wparam.0 as u32 == WM_KEYDOWN || wparam.0 as u32 == WM_SYSKEYDOWN) {
        let info = unsafe { &*(lparam.0 as *const KBDLLHOOKSTRUCT) };
        let class = classify_vk(info.vkCode);
        // Non-ignore keys are forwarded to the overlay thread.
    }
    unsafe { CallNextHookEx(None, code, wparam, lparam) }
}

fn classify_vk(vk: u32) -> KeyClass {
    match vk {
        VK_BACK | VK_DELETE => KeyClass::Delete,
        VK_LEFT | VK_RIGHT | VK_UP | VK_DOWN | VK_HOME | VK_END | VK_PRIOR | VK_NEXT
        | VK_INSERT | VK_ESCAPE => KeyClass::Ignore,
        VK_SHIFT | VK_LWIN | VK_RWIN | VK_CONTROL | VK_MENU => KeyClass::Ignore,
        _ => KeyClass::Text,
    }
}

struct MousePointer;

impl PointerSource for MousePointer {
    fn position(&mut self) -> Option<PointerPos> {
        let mut pt = Default::default();
        unsafe { GetCursorPos(&mut pt).ok()? };
        Some(PointerPos {
            x: pt.x as f32,
            y: pt.y as f32,
        })
    }
}
