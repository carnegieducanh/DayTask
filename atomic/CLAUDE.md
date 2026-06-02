# Atomic — CLAUDE.md

## Tổng quan

Windows 11 desktop app quản lý task hàng ngày + mục tiêu năm.

- **Tech stack:** Tauri v2 + React 19 + TypeScript + SQLite + @tabler/icons-react + @dnd-kit
- **Project path:** `C:\Users\huydu\Desktop\atomic_task\atomic\`
- **GitHub repo:** https://github.com/carnegieducanh/DayTask (branch: `main`)
- **Version hiện tại:** `0.1.6` (released 2026-06-02)

## Chạy dev server

```powershell
# Terminal phải là PowerShell (không phải bash)
# Nếu cargo không tìm thấy:
$env:PATH += ";$env:USERPROFILE\.cargo\bin"

cd "C:\Users\huydu\Desktop\atomic_task\atomic"
npm run tauri dev      # Full Tauri app (SQLite, notification, tray) — lần đầu ~5 min
npm run dev            # Chỉ Vite web (nhanh, UI only) → http://localhost:5173
```

## Build & Release

```powershell
# Build local
npm run tauri build
# Output: src-tauri/target/release/bundle/
#   msi/Atomic_0.1.1_x64_en-US.msi
#   nsis/Atomic_0.1.1_x64-setup.exe

# Release mới: push tag để GitHub Actions build tự động
git tag v0.X.X
git push origin main && git push origin v0.X.X
# → GitHub Actions (.github/workflows/release.yml) build + upload artifacts
```

## Trạng thái tính năng (tính đến 2026-06-02)

| #  | Tính năng                                    | Trạng thái                                              |
|----|----------------------------------------------|---------------------------------------------------------|
| 1  | Khởi tạo Tauri + React + TypeScript          | ✅ Xong                                                 |
| 2  | SQLite schema + Zustand store CRUD           | ✅ Xong                                                 |
| 3  | App layout + Sidebar 4 tab                   | ✅ Xong                                                 |
| 4  | TodayView: danh sách task, checkbox          | ✅ Xong                                                 |
| 5  | AddTaskModal: form nhập task                 | ✅ Xong                                                 |
| 6  | KanbanView: 4 cột + drag & drop @dnd-kit     | ✅ Xong                                                 |
| 7  | HeatmapView: calendar grid + màu activity    | ✅ Xong                                                 |
| 8  | System tray + Windows notification reminder  | ✅ Xong                                                 |
| 9  | Light/Dark mode toggle                       | ✅ Xong                                                 |
| 10 | Auto-update (tauri-plugin-updater)           | ✅ Xong — endpoint: DayTask/releases/latest/download/latest.json |
| 11 | Build .msi / .exe + GitHub Actions CI        | ✅ Xong — v0.1.3 released 2026-06-02                    |
| 12 | UI overhaul: Tabler icons, màu, layout       | ✅ Xong                                                 |
| 13 | Fix drag-drop khi zoom != 100%               | ✅ Xong — dùng `document.documentElement.style.fontSize` |
| 14 | Bảng màu danh mục 24 màu (Google Calendar)   | ✅ Xong — grid 6×4                                      |
| 15 | Tab Lịch — Month view (dot + tên)            | ✅ Xong                                                 |
| 16 | Tab Lịch — Week view tùy chỉnh (WeekView.tsx)| ✅ Xong — không có time grid, card đồng đều              |
| 17 | i18n: Tiếng Việt + English                   | ✅ Xong — `src/i18n/vi.ts` + `en.ts` + `index.ts`       |
| 18 | Undo delete toast (4 giây hoàn tác)          | ✅ Xong — `DeleteToast.tsx` + `softDeleteTask`          |
| 19 | TaskCard: click cả card → mở edit modal      | ✅ Xong — v0.1.2, stopPropagation trên checkbox/delete  |
| 20 | App icon redesign (SVG source, màu #DA7756)  | ✅ Xong — v0.1.3, xem mục Icon bên dưới                 |
| 21 | Auto-start khi mở máy (tauri-plugin-autostart)| ✅ Xong — v0.1.4, toggle trong SettingsModal            |
| 22 | Icon transparent bg + bigger (PNG-in-ICO)    | ✅ Xong — v0.1.6, fix BMP-in-ICO mất alpha → nền đen   |

## Tính năng đã có

- **Tabler Icons** (`@tabler/icons-react`): toàn bộ UI dùng SVG icon
- **Inline task editing**: double-click tên task → sửa trực tiếp
- **ReminderPopup in-app**: popup góc phải khi đến giờ nhắc, có nút "Dời 10 phút" + "Bỏ qua" + "Xem"
- **Snooze reminder**: state lưu trong Zustand (`snoozedUntil: Record<number, number>`)
- **Export JSON**: nút download ở topbar TodayView → xuất tasks ngày hiện tại ra `.json`
- **Import/Export toàn bộ**: backup JSON bao gồm tasks + goals + checklist + categoryColors
- **Kanban stats bar**: hiện số lượng từng cột + progress bar % năm
- **Bảng màu danh mục**: 24 màu Google Calendar, grid 6×4
- **Tab Lịch**: Month view (dot + tên) + Week view tùy chỉnh (card đồng đều, không có time grid)
- **i18n**: `useT()` hook, `localStorage.getItem('language')` → `'vi'` | `'en'`
- **Undo delete toast**: xóa task → toast 4 giây có nút "Hoàn tác", tự confirm sau 4s
- **Auto-update**: check khi khởi động, UpdateDialog hiện progress bar download
- **UI Scale**: `document.documentElement.style.fontSize = ${14 * uiScale}px` — tất cả rem/em tự scale

## Bảng màu danh mục — COLOR_PALETTE

Định nghĩa tại `AddTaskModal.tsx:6` và `AddGoalModal.tsx:6`.
CSS: `.cat-color-popup` dùng `grid-template-columns: repeat(6, 20px)`.

```
Hàng 1 (nhạt/ấm):   #F28B82  #FAAFA8  #FF8A65  #FDD835  #CDDC39  #7CB342
Hàng 2 (chuẩn/ấm):  #D50000  #E67C73  #F4511E  #F6BF26  #33B679  #0B8043
Hàng 3 (lạnh):      #4DB6AC  #039BE5  #3F51B5  #7986CB  #8E24AA  #7B1FA2
Hàng 4 (tím/xám):   #AB47BC  #CE93D8  #78909C  #9E9E9E  #616161  #546E7A
```

## Cấu trúc thư mục chính

```
atomic/
├── .github/workflows/release.yml   # GitHub Actions: build + upload khi push tag v*.*.*
├── src-tauri/src/
│   ├── main.rs          # Entry point (không sửa)
│   ├── lib.rs           # Plugin registration + DB migrations + tray setup
│   └── tray.rs          # System tray icon + menu
└── src/
    ├── App.tsx           # Root: theme, tab routing, DndContext, auto-update, DeleteToast
    ├── App.css           # Tất cả CSS (variables, layout, components, rbc-overrides)
    ├── types/index.ts    # TypeScript interfaces
    ├── store/appStore.ts # Zustand store — state + SQL + pendingDeleteTask
    ├── hooks/useReminder.ts  # Background reminder check mỗi phút + snooze logic
    ├── i18n/
    │   ├── vi.ts         # Tiếng Việt (source of truth cho type)
    │   ├── en.ts         # English (typeof vi)
    │   └── index.ts      # useT() hook → trả về vi hoặc en theo language state
    └── components/
        ├── Sidebar.tsx           # Nav với Tabler icons — 4 tab
        ├── ReminderPopup.tsx     # In-app reminder overlay (góc phải màn hình)
        ├── DeleteToast.tsx       # Toast xóa task + nút Hoàn tác (4 giây auto-confirm)
        ├── SettingsModal.tsx     # Font size, language, export/import backup
        ├── UpdateDialog.tsx      # Auto-update dialog với progress bar
        ├── today/
        │   ├── TodayView.tsx     # Layout + topbar + mini heatmap
        │   ├── TaskCard.tsx      # Card task — gọi softDeleteTask (không deleteTask)
        │   ├── AddTaskModal.tsx  # Form thêm/sửa task
        │   ├── DailyGreeting.tsx # Lời chào theo giờ
        │   └── MiniHeatmap.tsx   # Heatmap nhỏ trong TodayView
        ├── kanban/
        │   ├── KanbanView.tsx    # Layout kanban — không chứa DndContext
        │   ├── KanbanColumn.tsx  # Cột droppable
        │   ├── GoalCard.tsx      # Card mục tiêu draggable
        │   ├── GoalCardOverlay.tsx  # DragOverlay content (render trong App.tsx)
        │   └── AddGoalModal.tsx  # Form thêm/sửa mục tiêu
        ├── heatmap/
        │   ├── HeatmapView.tsx
        │   └── HeatmapGrid.tsx
        └── calendar/
            ├── CalendarView.tsx  # Toolbar + toggle Month/Week + load calendarTasks
            └── WeekView.tsx      # Week view tùy chỉnh — 7 cột, card đồng đều, không time grid
```

## Kiến trúc quan trọng

### UI Scale
Dùng `document.documentElement.style.fontSize = ${14 * uiScale}px`. Tất cả font/icon/padding dùng `rem`/`em` tự scale. Layout px (column width, sidebar) giữ nguyên. **KHÔNG dùng `transform: scale()`** vì làm lệch tọa độ @dnd-kit.

### Drag & Drop (Kanban)
`DndContext` nằm ở `App.tsx` bọc toàn bộ app — KHÔNG trong `KanbanView`. `DragOverlay` render trong `App.tsx`. `KanbanView` chỉ render UI thuần. `kanbanDragActiveId` lưu trong Zustand store.

### Undo Delete Toast
`softDeleteTask(id)` → xóa khỏi `tasks[]` ngay, lưu vào `pendingDeleteTask`.
`DeleteToast` component đọc `pendingDeleteTask`, set timeout 4s → gọi `confirmDeleteTask`.
Nếu user ấn "Hoàn tác" → `undoDeleteTask()` → restore task + cancel timer.

### Auto-update
- Plugin: `tauri-plugin-updater`
- Endpoint: `https://github.com/carnegieducanh/DayTask/releases/latest/download/latest.json`
- Check sau 3s khi app khởi động (trong `App.tsx` useEffect)
- Signing key: `TAURI_SIGNING_PRIVATE_KEY` secret trong GitHub repo

### i18n
```typescript
const t = useT(); // trong mọi component
t.taskCard.delete  // string
t.toast.deleted('Tên task')  // function → string
```
Thêm key mới: sửa `vi.ts` trước (là source of truth cho TypeScript type), `en.ts` tự báo lỗi nếu thiếu.

## App Icon

**Source:** SVG trong `src/assets/atomic_icon_final.html` (tag `<svg id="daytask-icon">`).
**Design:** Nền trong suốt (không có background rect). 3 ellipse orbit + nucleus + 2 electrons, màu `#DA7756`.
**Tham số:** stroke-width=7, nucleus r=11, electron r=7.5, ellipse rx=43 ry=16, electrons cx=±42.
**viewBox:** `"0 6 100 88"` — tight crop, fills ~97% width, ~93% height trong square canvas.
**ICO format:** PNG-in-ICO (KHÔNG dùng png-to-ico — nó tạo BMP-in-ICO, mất alpha → nền đen trên taskbar).

**Cách regenerate icon khi cần thay đổi:**
```powershell
# 1. Tạo script export-icons.mjs ở root atomic/ (xem mẫu trong feedback_patterns memory)
# 2. Chạy:
node export-icons.mjs
# 3. Xóa script sau khi xong
Remove-Item export-icons.mjs
```
Dependencies đã có: `sharp`. `.ico` phải có đủ: **16, 32, 48, 64, 128, 256px** (48 bắt buộc cho Windows desktop/taskbar).

## Next Steps

Chưa có tính năng tiếp theo được lên kế hoạch.

## Lưu ý quan trọng

- **Icons:** Dùng `@tabler/icons-react` — KHÔNG dùng webfont hay emoji
- **Capabilities:** Dùng `sql:allow-execute`, `sql:allow-select`, `sql:allow-load` — KHÔNG dùng `sql:default`
- **PATH issue:** Bash terminal không thấy `cargo`. Luôn dùng PowerShell
- **Capabilities thay đổi** → cần restart `npm run tauri dev`
- **DB file:** `%APPDATA%\com.atomic.app\atomic.db`
- **Git branch:** `main`
- **Export:** dùng Blob + URL.createObjectURL — không cần plugin Tauri fs/dialog
- **TaskCard delete:** gọi `softDeleteTask` (KHÔNG `deleteTask` trực tiếp)
