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

**KHÔNG cần build local.** GitHub Actions tự build khi push tag. Các bước release:

```powershell
# 1. Commit các thay đổi
git add <files>
git commit -m "mô tả thay đổi"

# 2. Bump version lên X.Y.Z trong 3 file:
#    - atomic/src-tauri/tauri.conf.json
#    - atomic/src-tauri/Cargo.toml
#    - atomic/package.json
git add atomic/src-tauri/tauri.conf.json atomic/src-tauri/Cargo.toml atomic/package.json
git commit -m "chore: bump version to X.Y.Z"

# 3. Tag + push → GitHub Actions tự build và upload artifacts
git tag vX.Y.Z
git push origin main && git push origin vX.Y.Z
# → GitHub Actions (.github/workflows/release.yml) build + upload artifacts
```

## Trạng thái tính năng (tính đến 2026-06-05)

| #  | Tính năng                                    | Trạng thái                                              |
|----|----------------------------------------------|---------------------------------------------------------|
| 1  | Khởi tạo Tauri + React + TypeScript          | ✅ Xong                                                 |
| 2  | SQLite schema + Zustand store CRUD           | ✅ Xong                                                 |
| 3  | App layout + Sidebar 5 tab                   | ✅ Xong                                                 |
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
| 23 | Tab Journal: Biết ơn + Bài học               | ✅ Xong UI — 2026-06-05, xem mục Journal bên dưới       |
| 24 | Right-click TaskCard: xóa + đổi màu task     | ✅ Xong — 2026-06-06, xem mục Task Color bên dưới       |

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
- **Right-click context menu trên TaskCard**: xóa task (có undo toast) + chọn màu riêng cho task (24 màu, override màu category)

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
    ├── store/journalDb.ts # Journal DB functions — không dùng Zustand, self-contained
    ├── hooks/useReminder.ts  # Background reminder check mỗi phút + snooze logic
    ├── i18n/
    │   ├── vi.ts         # Tiếng Việt (source of truth cho type)
    │   ├── en.ts         # English (typeof vi)
    │   └── index.ts      # useT() hook → trả về vi hoặc en theo language state
    └── components/
        ├── Sidebar.tsx           # Nav với Tabler icons — 5 tab (thêm journal giữa kanban/heatmap)
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
        ├── calendar/
        │   ├── CalendarView.tsx  # Toolbar + toggle Month/Week + load calendarTasks
        │   └── WeekView.tsx      # Week view tùy chỉnh — 7 cột, card đồng đều, không time grid
        └── journal/
            └── JournalView.tsx   # Full Journal tab: layout 2 cột, tất cả sub-components nội tuyến
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

## Task Color (Right-click Context Menu)

### Mô tả
Right-click vào TaskCard → popup nhỏ xuất hiện tại vị trí chuột (tự điều chỉnh nếu gần mép màn hình) gồm:
- Nút **Delete** (IconTrash) → gọi `softDeleteTask` → hiện undo toast 4 giây như bình thường
- Divider
- Grid 24 màu (4 hàng × 6 cột) — màu đang chọn hiện dấu ✓ trắng; click lại màu đang chọn → reset về `null` (quay lại màu category)

### Data model
`tasks` table có thêm column `color TEXT DEFAULT NULL` (migration v11 trong `lib.rs`).
`Task` interface (`types/index.ts`) có field `color: string | null`.
`TaskUpdate` interface có `color?: string | null`.

### Store
`updateTaskColor(id, color)` trong `appStore.ts`:
- Update đồng thời `tasks` và `calendarTasks` trong Zustand state (để calendar re-render ngay)
- Chạy `UPDATE tasks SET color = $1 WHERE id = $2` vào SQLite

### Màu hiệu quả (effective color)
Mọi nơi render màu task đều dùng pattern: `task.color ?? categoryColors[task.category]`
- `TaskCard.tsx` — `cardBg`
- `WeekView.tsx`, `MonthView.tsx` (2 chỗ: cell + popover), `DayView.tsx` (3 chỗ: deck, block, drag preview)
- `AddTaskModal.tsx` — dot trong trigger và item đang chọn của category dropdown

### CSS
Classes trong `App.css`: `.task-context-menu`, `.task-context-divider`, `.task-context-colors`, `.task-context-color-btn`
Reuse `.day-context-item` và `.day-context-item-danger` từ DayView context menu.

### Files đã sửa
- `src-tauri/src/lib.rs` — migration v11
- `src/types/index.ts` — Task + TaskUpdate
- `src/store/appStore.ts` — updateTaskColor (interface + implement), SELECT queries
- `src/store/mockDb.ts` — `color: null` trên mọi mock task
- `src/components/today/TaskCard.tsx` — context menu + effective color
- `src/components/calendar/WeekView.tsx` — effective color
- `src/components/calendar/MonthView.tsx` — effective color (2 chỗ)
- `src/components/calendar/DayView.tsx` — effective color (3 chỗ)
- `src/components/today/AddTaskModal.tsx` — effective color trên dot
- `src/App.css` — CSS context menu

## Journal Tab

### Files liên quan
- `src/components/journal/JournalView.tsx` — toàn bộ UI (layout, sub-components nội tuyến)
- `src/store/journalDb.ts` — tất cả DB queries (không dùng Zustand)
- `src-tauri/src/lib.rs` — migration version 10 (`journal_entries` table)

### Schema
```sql
CREATE TABLE journal_entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT NOT NULL,           -- 'YYYY-MM-DD'
  type       TEXT NOT NULL CHECK(type IN ('gratitude','lesson')),
  items      TEXT NOT NULL DEFAULT '[]',  -- JSON array of strings
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_journal_date ON journal_entries(date, type);
```

### Kiến trúc
- **Không dùng Zustand** — `JournalView` tự quản lý state local (`useState`)
- **journalDb.ts** export functions: `dbGetJournal`, `dbSaveJournal`, `dbDeleteJournal`, `dbGetJournalHistory`, `dbGetJournalStreak`, `dbGetJournalStats`, `dbGetDatesWithEntries`
- Tất cả functions check `isTauri()` — nếu false thì return null/[] (browser mode không có data)
- `items` field lưu dưới dạng JSON string trong SQLite, parse khi đọc ra
- `dbGetJournalHistory` nhận `excludeDate` để loại hôm nay khỏi lịch sử

### Màu sắc
- Biết ơn (gratitude): accent `#DA7756`, prompt bg `#211509`, prompt border `#3D2410`
- Bài học (lesson): accent `#EF9F27`, prompt bg `#1C1508`, prompt border `#382C0A`

### Trạng thái (2026-06-05)
- ✅ Tab trong topbar (IconNotebook, giữa Kế hoạch năm và Heatmap)
- ✅ Layout 2 cột: sidebar 200px + main scrollable
- ✅ Sidebar: mini calendar tháng, streak counter, stats tháng
- ✅ Journal Head: date tiếng Việt + toggle Biết ơn/Bài học
- ✅ Prompt Banner: ẩn khi gõ, ẩn khi bấm X
- ✅ Write Card: textarea auto-resize, thêm/xóa ô, char count, nút Lưu
- ✅ SQLite save/load entry hôm nay
- ✅ Entry Cards: hiển thị lịch sử, edit inline, xóa
- ✅ Streak counter + stats tháng kết nối DB
- ✅ Mini calendar highlight ngày có entry
- ⏳ Seed data giả để test UI (việc tiếp theo — xem Next Steps)

## Next Steps

**Việc tiếp theo: Thêm seed data giả cho Journal để test UI**

Thêm hàm `seedJournalIfEmpty()` vào `src/store/journalDb.ts`:
- Check: `SELECT COUNT(*) FROM journal_entries` — nếu = 0 thì seed
- Seed 14 ngày gần nhất (tính từ hôm nay - 1, không seed hôm nay)
- Mỗi ngày seed entry cho cả 2 loại: `gratitude` (3 items) và `lesson` (1 item)
- Dùng nội dung tiếng Việt thực tế, đa dạng (không lặp lại)
- Gọi hàm này từ `JournalView.tsx` trong `useEffect` mount, TRƯỚC `loadAll()`
- Pattern tương tự `seedMockData` trong `appStore.ts`

```typescript
// journalDb.ts — thêm hàm này
export async function seedJournalIfEmpty(): Promise<void> {
  if (!isTauri()) return;
  const db = await getDb();
  const rows = await db.select<{ c: number }[]>('SELECT COUNT(*) as c FROM journal_entries');
  if (rows[0].c > 0) return;
  // seed 14 ngày...
}

// JournalView.tsx — trong useEffect mount
useEffect(() => {
  seedJournalIfEmpty().then(() => loadAll(activeType));
}, []);
```

## Known Patterns & Fixes

### Tray Popup Flickering — Pre-warm Window

**Hiện tượng:** Click system tray icon lần đầu có hiệu ứng nháy/giật vì window được tạo mới → webview load → React mount → data fetch → render, tất cả diễn ra khi window đã visible.

**Fix:** Tạo cả 2 window ẩn (`visible(false)`) ngay trong `setup_tray()` lúc app khởi động. Click handler chỉ cần `set_position()` + `show()`.

```rust
// Trong setup_tray(), TRƯỚC TrayIconBuilder:
let _ = tauri::WebviewWindowBuilder::new(app, "tray-popup", ...)
    .position(-2000.0, -2000.0)
    .visible(false)   // ← key: tạo ẩn
    .build();
// Click handler: chỉ cần show(), không tạo window mới
```

**Áp dụng cho:** Mọi Tauri app có tray popup cần load data.

---

### Tab Enter Animation — CSS-only, không cần JS

**Cách hoạt động:** Vì mỗi tab view được render bằng `{activeTab === 'x' && <XView />}`, component remount mỗi lần switch tab → CSS `animation` tự phát lại mà không cần thêm logic JS nào.

**Keyframes dùng chung (đã có trong `App.css`):**
```css
@keyframes today-topbar-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes today-sidebar-in { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
@keyframes today-main-in   { from { opacity: 0; transform: translateY(10px); }  to { opacity: 1; transform: translateY(0); } }
@keyframes today-right-in  { from { opacity: 0; transform: translateX(10px); }  to { opacity: 1; transform: translateX(0); } }
```

**Mapping tab → class → animation đang dùng:**

| Tab | CSS class | Keyframe | Delay |
|---|---|---|---|
| Today | `.today-topbar` | `today-topbar-in` | 0ms |
| Today | `.today-sidebar` | `today-sidebar-in` | 40ms |
| Today | `.today-main` | `today-main-in` | 80ms |
| Today | `.today-right` | `today-right-in` | 40ms |
| Heatmap | `.view-topbar:not(.today-topbar)` | `today-topbar-in` | 0ms |
| Heatmap | `.view-content:not(.today-content)` | `today-main-in` | 60ms |
| Year Plan | `.kanban-stats-bar` | `today-topbar-in` | 0ms |
| Year Plan | `.kanban-drag-hint` | `today-main-in` | 40ms |
| Year Plan | `.kanban-board` | `today-main-in` | 80ms |
| Calendar | `.cal-wrap` | `today-main-in` | 0ms |
| Journal | `.journal-sidebar` | `today-sidebar-in` | 40ms |
| Journal | `.journal-main` | `today-main-in` | 80ms |

**Template thêm animation cho tab mới:**
```css
/* Trong App.css — thêm vào block "Tab Enter Animations" */
.ten-class-wrapper {
  animation: today-main-in 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94) Xms both;
}
```
- Easing chuẩn: `cubic-bezier(0.25, 0.46, 0.45, 0.94)`
- Duration: 0.28–0.35s (topbar nhanh hơn, content chậm hơn)
- `both` = giữ trạng thái `opacity: 0` trước khi animation chạy
- Stagger: mỗi element tiếp theo tăng thêm ~40ms delay

**Lưu ý:** `.view-topbar` và `.view-content` là class dùng chung. Heatmap dùng `:not(.today-topbar)` / `:not(.today-content)` để tránh đụng Today. Tab mới nên có wrapper class riêng.

---

## Lưu ý quan trọng

- **Icons:** Dùng `@tabler/icons-react` — KHÔNG dùng webfont hay emoji
- **Capabilities:** Dùng `sql:allow-execute`, `sql:allow-select`, `sql:allow-load` — KHÔNG dùng `sql:default`
- **PATH issue:** Bash terminal không thấy `cargo`. Luôn dùng PowerShell
- **Capabilities thay đổi** → cần restart `npm run tauri dev`
- **DB file:** `%APPDATA%\com.atomic.app\atomic.db`
- **Git branch:** `main`
- **Export:** dùng Blob + URL.createObjectURL — không cần plugin Tauri fs/dialog
- **TaskCard delete:** gọi `softDeleteTask` (KHÔNG `deleteTask` trực tiếp)
