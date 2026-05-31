# DayTask — CLAUDE.md

## Tổng quan
Windows 11 desktop app quản lý task hàng ngày + mục tiêu năm.
- **Tech stack:** Tauri v2 + React 19 + TypeScript + SQLite + @tabler/icons-react + @dnd-kit
- **Project path:** `C:\Users\huydu\Desktop\daily_task\daytask\`
- **GitHub repo:** https://github.com/carnegieducanh/DayTask (branch: `main`)
- **Spec gốc:** `C:\Users\huydu\Desktop\daily_task\DAYTASK_PROJECT_BRIEF_v2.md`

## Chạy dev server
```powershell
# Terminal phải là PowerShell (không phải bash)
# Nếu cargo không tìm thấy:
$env:PATH += ";$env:USERPROFILE\.cargo\bin"

cd "C:\Users\huydu\Desktop\daily_task\daytask"
npm run tauri dev      # Full Tauri app (SQLite, notification, tray) — lần đầu ~5 min
npm run dev            # Chỉ Vite web (nhanh, UI only) → http://localhost:5173
```

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
| 10 | Auto-update (tauri-plugin-updater) | ⏳ GitHub repo đã có, chưa config updater |
| 11 | Build .msi / .exe | ✅ Xong — v0.1.0 build thành công |
| 12 | UI overhaul theo mockup + tính năng mới | ✅ Xong (session 2026-05-31) |

## Tính năng đã có (sau session 2026-05-31)
- **Tabler Icons** (`@tabler/icons-react`): toàn bộ UI dùng SVG icon, không còn emoji/text symbol
- **Inline task editing**: double-click tên task → sửa trực tiếp (không mở modal)
- **ReminderPopup in-app**: popup góc phải khi đến giờ nhắc, có nút "Dời 10 phút" + "Bỏ qua" + "Xem"
- **Snooze reminder**: state lưu trong Zustand (`snoozedUntil: Record<number, number>`)
- **Export JSON**: nút download ở topbar TodayView → xuất tasks ngày hiện tại ra `.json`
- **Kanban stats bar**: bar dưới topbar hiện số lượng từng cột + progress bar % năm
- **Column icons**: mỗi cột Kanban có icon riêng (circle-dashed, loader, eye, circle-check)

## Bước tiếp theo — Bước 10 (Auto-update)
GitHub repo đã có tại `https://github.com/carnegieducanh/DayTask`. Các việc cần làm:

### 1. Generate signing keypair
```powershell
cd "C:\Users\huydu\Desktop\daily_task\daytask"
npm run tauri signer generate -- -w "$env:USERPROFILE\.tauri\daytask.key"
# Lưu lại public key được in ra màn hình
```

### 2. Thêm vào `src-tauri/tauri.conf.json`
```json
"plugins": {
  "updater": {
    "endpoints": [
      "https://github.com/carnegieducanh/DayTask/releases/latest/download/latest.json"
    ],
    "dialog": true,
    "pubkey": "PASTE_PUBLIC_KEY_HERE"
  }
}
```

### 3. Đăng ký plugin trong `src-tauri/src/lib.rs`
```rust
.plugin(tauri_plugin_updater::Builder::new().build())
```

### 4. Frontend check update
```typescript
import { check } from '@tauri-apps/plugin-updater';
// Gọi khi app khởi động trong App.tsx useEffect
```

### 5. Tạo GitHub Release
- Build với `npm run tauri build` (đã sign với private key)
- Upload artifacts lên GitHub Release
- Tạo file `latest.json` theo format Tauri updater

## Cấu trúc thư mục chính
```
daytask/
├── src-tauri/src/
│   ├── main.rs          # Entry point (không sửa)
│   ├── lib.rs           # Plugin registration + DB migrations + tray setup
│   └── tray.rs          # System tray icon + menu
├── src/
│   ├── App.tsx           # Root: theme, tab routing, useReminder hook, ReminderPopup
│   ├── App.css           # Tất cả CSS (variables, layout, components)
│   ├── types/index.ts    # TypeScript interfaces
│   ├── store/appStore.ts # Zustand store — toàn bộ state + SQL queries + reminder state
│   ├── hooks/useReminder.ts  # Background reminder check mỗi phút + snooze logic
│   └── components/
│       ├── Sidebar.tsx           # Nav với Tabler icons
│       ├── ReminderPopup.tsx     # In-app reminder overlay (góc phải màn hình)
│       ├── today/TodayView.tsx + TaskCard.tsx + AddTaskModal.tsx
│       ├── kanban/KanbanView.tsx + KanbanColumn.tsx + GoalCard.tsx + AddGoalModal.tsx
│       └── heatmap/HeatmapView.tsx + HeatmapGrid.tsx
```

## Lưu ý quan trọng
- **Icons:** Dùng `@tauri-apps/icons-react` — KHÔNG dùng webfont hay emoji. Import từng icon: `import { IconSun } from '@tauri-apps/icons-react'`
- **Capabilities:** Dùng `sql:allow-execute`, `sql:allow-select`, `sql:allow-load` — KHÔNG dùng `sql:default`
- **PATH issue:** Bash terminal không thấy `cargo`. Luôn dùng PowerShell
- **Capabilities thay đổi** → cần restart `npm run tauri dev`
- **Reminder snooze:** State lưu trong `appStore.snoozedUntil` (Record<number, number>), KHÔNG phải localStorage
- **Inline edit:** double-click task name để sửa nhanh; single click mở modal
- **Export:** dùng Blob + URL.createObjectURL — không cần plugin Tauri fs/dialog
- **Git branch:** `main` (không phải master)
- **DB file:** `%APPDATA%\com.daytask.app\daytask.db`
