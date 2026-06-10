use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, LogicalPosition, Manager,
};

const POPUP_W: f64 = 300.0;
const POPUP_H: f64 = 220.0;
const CONTEXT_W: f64 = 170.0;
const CONTEXT_H: f64 = 90.0;

pub fn setup_tray(app: &App) -> tauri::Result<()> {
    // Pre-warm both tray windows hidden at startup so the webview and data are
    // ready before the user first clicks the tray icon, preventing visible flicker.
    let popup = tauri::WebviewWindowBuilder::new(
        app,
        "tray-popup",
        tauri::WebviewUrl::App("index.html".into()),
    )
    .title("Atomic")
    .inner_size(POPUP_W, POPUP_H)
    .position(-2000.0, -2000.0)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .shadow(true)
    .visible(false)
    .build();

    #[cfg(target_os = "windows")]
    if let Ok(ref w) = popup {
        window_vibrancy::apply_acrylic(w, Some((12, 12, 15, 210))).ok();
    }

    let ctx = tauri::WebviewWindowBuilder::new(
        app,
        "tray-context",
        tauri::WebviewUrl::App("index.html".into()),
    )
    .title("Atomic")
    .inner_size(CONTEXT_W, CONTEXT_H)
    .position(-2000.0, -2000.0)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .shadow(true)
    .visible(false)
    .build();

    #[cfg(target_os = "windows")]
    if let Ok(ref w) = ctx {
        window_vibrancy::apply_acrylic(w, Some((12, 12, 15, 210))).ok();
    }

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .show_menu_on_left_click(false)
        .tooltip("Atomic")
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button,
                button_state: MouseButtonState::Up,
                position,
                ..
            } = event
            {
                let app = tray.app_handle();

                let scale = app
                    .primary_monitor()
                    .ok()
                    .flatten()
                    .map(|m| m.scale_factor())
                    .unwrap_or(1.0);

                let cx = position.x / scale;
                let cy = position.y / scale;

                match button {
                    MouseButton::Left => {
                        let x = (cx - POPUP_W / 2.0).max(4.0);
                        let y = (cy - POPUP_H - 8.0).max(4.0);

                        if let Some(ctx) = app.get_webview_window("tray-context") {
                            let _ = ctx.hide();
                        }

                        if let Some(popup) = app.get_webview_window("tray-popup") {
                            if popup.is_visible().unwrap_or(false) {
                                let _ = popup.hide();
                            } else {
                                let _ = popup.set_position(LogicalPosition::new(x, y));
                                let _ = popup.show();
                                let _ = popup.set_focus();
                            }
                        }
                    }
                    MouseButton::Right => {
                        let x = (cx - CONTEXT_W / 2.0).max(4.0);
                        let y = (cy - CONTEXT_H - 8.0).max(4.0);

                        if let Some(popup) = app.get_webview_window("tray-popup") {
                            let _ = popup.hide();
                        }

                        if let Some(ctx) = app.get_webview_window("tray-context") {
                            if ctx.is_visible().unwrap_or(false) {
                                let _ = ctx.hide();
                            } else {
                                let _ = ctx.set_position(LogicalPosition::new(x, y));
                                let _ = ctx.show();
                                let _ = ctx.set_focus();
                            }
                        }
                    }
                    _ => {}
                }
            }
        })
        .build(app)?;

    Ok(())
}
