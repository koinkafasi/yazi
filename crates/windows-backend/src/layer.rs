use anyhow::Result;
use pc_core::{EmitKind, KeyClass, ParticleSystem, PointerPos, PointerSource, Rect};
use std::sync::mpsc::Receiver;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::Graphics::Gdi::{
    BitBlt, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, ReleaseDC, SelectObject,
    SetStretchBltMode, StretchBlt, HALFTONE, HBITMAP, SRCCOPY,
};
use windows::Win32::UI::HiDpi::GetDpiForWindow;
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DispatchMessageW, GetMessageW, GetSystemMetrics,
    RegisterClassW, SetLayeredWindowAttributes, SetTimer, SetWindowPos, TranslateMessage,
    CS_HREDRAW, CS_VREDRAW, LWA_ALPHA, MSG, SM_CXSCREEN, SM_CYSCREEN, SWP_FRAMECHANGED,
    SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW, WS_EX_LAYERED, WS_EX_TOOLWINDOW, WS_EX_TRANSPARENT,
    WS_POPUP,
};

pub fn run_overlay(
    sys: Arc<Mutex<ParticleSystem>>,
    rx: Receiver<KeyClass>,
    pointer: &mut dyn PointerSource,
) {
    loop {
        if let Ok(class) = rx.try_recv() {
            if let Some(kind) = class.emit_kind() {
                if let Some(pos) = pointer.position() {
                    let mut s = sys.lock().unwrap();
                    s.emit(kind, pos.x, pos.y);
                }
            }
        }
        std::thread::sleep(Duration::from_millis(1));
    }
}
