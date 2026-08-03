use anyhow::Result;
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::Shell::{
    Shell_NotifyIconW, NIF_ICON, NIF_MESSAGE, NIF_TIP, NIM_ADD, NOTIFYICONDATAW,
};
use windows::Win32::UI::WindowsAndMessaging::{
    LoadIconW, IDI_APPLICATION, WM_USER,
};

pub fn create_tray(hwnd: HWND) -> Result<()> {
    let mut nid = NOTIFYICONDATAW {
        cbSize: std::mem::size_of::<NOTIFYICONDATAW>() as u32,
        hWnd: hwnd,
        uID: 1,
        uFlags: NIF_ICON | NIF_MESSAGE | NIF_TIP,
        uCallbackMessage: WM_USER + 1,
        hIcon: unsafe { LoadIconW(None, IDI_APPLICATION)? },
        ..Default::default()
    };
    let tip = "imlec-typer\0".encode_utf16().collect::<Vec<_>>();
    nid.szTip[..tip.len().min(128)].copy_from_slice(&tip[..tip.len().min(128)]);
    unsafe { Shell_NotifyIconW(NIM_ADD, &nid)? };
    Ok(())
}
