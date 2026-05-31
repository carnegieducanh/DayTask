# DayTask — CLAUDE.md

## Tổng quan
Windows 11 desktop app quản lý task hàng ngày + mục tiêu năm.
- **Tech stack:** Tauri v2 + React 19 + TypeScript + SQLite
- **Project path:** `C:\Users\huydu\Desktop\daily_task\daytask\`
- **Spec gốc:** `C:\Users\huydu\Desktop\daily_task\DAYTASK_PROJECT_BRIEF_v2.md`

## Chạy dev server
```powershell
# Terminal phải là PowerShell (không phải bash)
# Nếu cargo không tìm thấy:
$env:PATH += ";$env:USERPROFILE\.cargo\bin"

cd "C:\Users\huydu\Desktop\daily_task\daytask"
npm run tauri dev
```
Lần đầu build Rust mất ~5–10 phút. Các lần sau ~30 giây.

## Build installer
```powershell
npm run tauri build
# Output: src-tauri/target/release/bundle/
#   msi/DayTask_0.1.0_x64_en-US.msi
#   nsis/DayTask_0.1.0_x64-setup.exe
```

## Trạng thái build (tính đến 2026-05-31)

| Bước | Mô tả | Trạng thái |
|------|-------|-----------|
| 1 | Khởi tạo project Tauri + React + TypeScript | ✅ Xong |
| 2 | SQLite schema + Zustand store CRUD | ✅ Xong |
| 3 | App layout + Sidebar 3 tab | ✅ Xong |
| 4 | TodayView: danh sách task, checkbox | ✅ Xong |
| 5 | AddTaskModal: form nhập task | ✅ Xong |
| 6 | KanbanView: 4 cột + drag & drop @dnd-kit | ✅ Xong |
| 7 | HeatmapView: calendar grid + màu activity | ✅ Xong |
| 8 | System tray + Windows notification reminder | ✅ Xong |
| 9 | Light/Dark mode toggle | ✅ Xong |
| 10 | Auto-update (tauri-plugin-updater) | ⏳ Cần GitHub repo |
| 11 | Build .msi / .exe | ✅ Xong — v0.1.0 build thành công |

## Bước tiếp theo (Bước 10 — Auto-update)
Yêu cầu:
1. Tạo GitHub repo và push code lên
2. Generate signing keypair: `npm run tauri signer generate -- -w ~/.tauri/daytask.key`
3. Thêm public key vào `tauri.conf.json`:
   ```json
   "plugins": {
     "updater": {
       "endpoints": ["https://github.com/USER/daytask/releases/latest/download/latest.json"],
       "dialog": true,
       "pubkey": "PASTE_PUBLIC_KEY_HERE"
     }
   }
   ```
4. Đăng ký plugin trong `lib.rs`: `.plugin(tauri_plugin_updater::Builder::new().build())`
5. Frontend: gọi `check()` từ `@tauri-apps/plugin-updater` khi app khởi động

## Cấu trúc thư mục chính
```
daytask/
├── src-tauri/src/
│   ├── main.rs          # Entry point (không sửa)
│   ├── lib.rs           # Plugin registration + DB migrations + tray setup
│   └── tray.rs          # System tray icon + menu
├── src/
│   ├── App.tsx           # Root: theme, tab routing, useReminder hook
│   ├── App.css           # Tất cả CSS (variables, layout, components)
│   ├── types/index.ts    # TypeScript interfaces
│   ├── store/appStore.ts # Zustand store — toàn bộ state + SQL queries
│   ├── hooks/useReminder.ts  # Background reminder check mỗi phút
│   └── components/
│       ├── Sidebar.tsx
│       ├── today/TodayView.tsx + TaskCard.tsx + AddTaskModal.tsx
│       ├── kanban/KanbanView.tsx + KanbanColumn.tsx + GoalCard.tsx + AddGoalModal.tsx
│       └── heatmap/HeatmapView.tsx + HeatmapGrid.tsx
```

## Lưu ý quan trọng
- **Capabilities:** Dùng `sql:allow-execute`, `sql:allow-select`, `sql:allow-load` — KHÔNG dùng `sql:default` (không tồn tại)
- **PATH issue:** Bash terminal không thấy `cargo`. Luôn dùng PowerShell hoặc chạy `source "$HOME/.cargo/env"` trước
- **Capabilities thay đổi** → cần restart `npm run tauri dev` (không hot-reload)
- **Frontend changes** → Vite hot-reload, không cần restart
- **Rust changes** → cargo tự recompile, cần chờ ~30s
- **DB file:** `%APPDATA%\com.daytask.app\daytask.db` (SQLite, migrations tự chạy khi app start)
