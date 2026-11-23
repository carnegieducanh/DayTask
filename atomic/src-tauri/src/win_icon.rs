//! Icon chất lượng đầy đủ cho cửa sổ + tray trên Windows.
//! Tauri chỉ lấy frame ĐẦU TIÊN của icon.ico (thường 16×16) làm icon runtime và
//! chỉ gán ICON_SMALL. Ở đây nạp lại từ icon nhúng trong exe (đủ mọi size), đúng DPI.
use core::ffi::c_void;
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::UI::HiDpi::{GetDpiForSystem, GetDpiForWindow, GetSystemMetricsForDpi};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    LoadImageW, SendMessageW, ICON_BIG, ICON_SMALL, IMAGE_ICON, LR_DEFAULTCOLOR, SM_CXICON,
    SM_CXSMICON, WM_SETICON,
};

/// ID resource mà tauri-build gán cho icon.ico khi nhúng vào exe.
const APP_ICON_ID: u16 = 32512;

/// Gán ICON_BIG (Alt+Tab, taskbar khi không gộp) + ICON_SMALL (title bar) đúng size theo DPI.
/// Gọi lại khi cửa sổ đổi màn hình/DPI (WindowEvent::ScaleFactorChanged).
pub fn apply_window_icons(window: &tauri::WebviewWindow) {
    let Ok(hwnd) = window.hwnd() else { return };
    let hwnd = hwnd.0 as *mut c_void;
    unsafe {
        let hinst = GetModuleHandleW(core::ptr::null());
        let dpi = GetDpiForWindow(hwnd);
        for (kind, metric) in [(ICON_BIG, SM_CXICON), (ICON_SMALL, SM_CXSMICON)] {
            let px = GetSystemMetricsForDpi(metric, dpi);
            let icon = LoadImageW(hinst, APP_ICON_ID as usize as *const u16, IMAGE_ICON, px, px, LR_DEFAULTCOLOR);
            if !icon.is_null() {
                SendMessageW(hwnd, WM_SETICON, kind as usize, icon as isize);
            }
        }
    }
}

/// Thay icon tray (mặc định là bitmap 16×16) bằng frame đúng size theo DPI hệ thống.
pub fn apply_tray_icon(tray: &tauri::tray::TrayIcon) {
    let px = unsafe { GetSystemMetricsForDpi(SM_CXSMICON, GetDpiForSystem()) } as u32;
    let _ = tray.with_inner_tray_icon(move |inner| {
        if let Ok(icon) = tray_icon::Icon::from_resource(APP_ICON_ID, Some((px, px))) {
            let _ = inner.set_icon(Some(icon));
        }
    });
}
