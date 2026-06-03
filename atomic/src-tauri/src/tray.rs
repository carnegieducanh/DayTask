use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, LogicalPosition, Manager,
};

const POPUP_W: f64 = 300.0;
const POPUP_H: f64 = 158.0;

pub fn setup_tray(app: &App) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show", "Hiện cửa sổ", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Thoát Atomic", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Atomic")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
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

                // Convert physical cursor position to logical coords
                let cx = position.x / scale;
                let cy = position.y / scale;

                // Place popup above cursor, horizontally centered
                let x = (cx - POPUP_W / 2.0).max(4.0);
                let y = (cy - POPUP_H - 8.0).max(4.0);

                if let Some(popup) = app.get_webview_window("tray-popup") {
                    if popup.is_visible().unwrap_or(false) {
                        let _ = popup.hide();
                    } else {
                        let _ = popup.set_position(LogicalPosition::new(x, y));
                        let _ = popup.show();
                        let _ = popup.set_focus();
                    }
                } else if let Ok(popup) = tauri::WebviewWindowBuilder::new(
                    app,
                    "tray-popup",
                    tauri::WebviewUrl::App("index.html".into()),
                )
                .title("Atomic")
                .inner_size(POPUP_W, POPUP_H)
                .position(x, y)
                .decorations(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .resizable(false)
                .shadow(true)
                .build()
                {
                    let _ = popup.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
