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

**Source:** SVG trong `public/atom-icon.svg` (cũng là favicon + logo sidebar, xem `index.html` + `Sidebar.tsx`).
**Design:** Nền trong suốt (không có background rect). 2 vòng oval bất đối xứng (đầu dài R=230, đầu ngắn R=150) xoay ±42°, stroke gradient.
**Gradient `atomGradient`:** `#6A3E8C` (tím) → `#B24C63` (hồng) → `#DA7756` (cam), góc 15%,0% → 85%,100%.
**Tham số hiện tại (đã revert về đúng bản này, 2026-07-15):** viewBox `0 0 534 534`, tâm xoay `translate(267 260)`, mỗi path có `scale(1.15)` trong transform + `stroke-width="40"`. Fill ~82-89% canvas, margin an toàn mọi phía (không chạm mép).
- Lần 1: thử `scale(1.2)` + giữ nguyên `stroke-width="28"` → to hơn (fill ~86-93%) nhưng vẫn bị chê "nhỏ và mờ" ở taskbar thật.
- Lần 2: tăng `stroke-width` 28→40 (ring dày hơn hẳn) + giảm `scale` 1.2→1.15 (bù lại để không tràn mép, vì stroke dày hơn cũng làm bbox phình ra). Bài học quan trọng: **độ dày nét ảnh hưởng đến cảm giác "to/rõ" nhiều hơn là chỉ phóng to bounding box** — icon dạng "vòng nét mảnh" (thin ring outline) luôn có nhiều khoảng trống rỗng bên trong/giữa các nét dù bounding box đã lấp đầy canvas, nên nhìn vẫn "mờ/nhỏ" so với icon dạng khối đặc (như VS Code). Muốn kiểm tra nhanh không cần rebuild Tauri: dựng script sharp render icon ở size thật (16/32/48) rồi composite lên nền tối `#1c1c1c`, phóng to bằng `kernel: 'nearest'` để xem rõ pixel — mô phỏng đúng cách taskbar hiển thị.
- **Lần 3 (2026-07-15, session sau — VẤN ĐỀ CHƯA GIẢI QUYẾT, cần session khác tiếp tục):** User vẫn chê icon nhỏ/mờ so với VSCode ở taskbar thật (ảnh chụp thực tế, kể cả sau khi đã `ie4uinit.exe -ClearIconCache` + restart explorer.exe — nên **xác nhận đây không phải do Windows icon cache**, mà do bản chất thiết kế). Đã verify bằng cách trích icon trực tiếp từ `.exe` đã build (PowerShell `[System.Drawing.Icon]::ExtractAssociatedIcon(...)`) — không qua Explorer/taskbar cache — vẫn thấy hình mảnh/mờ y hệt.
  - Đã giải thích cho user: navbar dùng `<img src="/atom-icon.svg">` (Sidebar.tsx:122) — trình duyệt render vector trực tiếp ở bất kỳ size CSS nào nên luôn nét; còn taskbar dùng bitmap cố định trong `.ico` ở ô size nhỏ do **Windows shell quyết định** (app không kiểm soát được kích thước ô hiển thị) — đây là lý do 2 chỗ khó dễ khác nhau.
  - Đã test rider "chỉ tăng `scale` giữ nguyên `stroke-width=40`" (scale 1.4, `translate(228.8 267.3)`) — render preview 24px thật vẫn còn lỗ hổng rõ giữa các nét, **không đủ để giải quyết** — xác nhận lại bài học lần 2: bounding box to hơn không tương đương "đặc/rõ" hơn.
  - **2 phương án đã dựng preview và xác nhận rõ/đậm hơn hẳn ở size thật (16/24/32px, dùng script sharp render + composite nền `#1c1c1c` + `kernel:'nearest'`), nhưng CHƯA áp vào file thật (đã bị revert theo yêu cầu user để giữ nguyên trạng chờ quyết định):**
    - **A. Outline đậm hơn:** `translate(231 267) rotate(±42) scale(1.25)`, `stroke-width="70"` (giữ `fill="none"` + stroke). Margin còn lại: ~42.5px ngang, ~26.5px dọc (an toàn, không tràn viewBox 534). Rõ hơn hẳn bản hiện tại nhưng vẫn là dạng outline nên không đặc bằng phương án B.
    - **B. Khối đặc (khuyến nghị — giống cách VSCode/Slack làm, transparent bg + solid mark thay vì thin outline):** `translate(223.8 267.3) rotate(±42) scale(1.5)`, **bỏ stroke, đổi `fill="url(#atomGradient)"` trực tiếp trên path** (path gốc vốn là 1 contour khép kín dạng vesica/stadium — fill thẳng sẽ ra 2 hình oval đặc chồng nhau tạo khối "X"/pinwheel đặc màu). Margin: ~50px ngang, ~30px dọc. Đậm/rõ nhất trong các phương án đã thử, gần với độ "nặng" của icon cũ (bản circle+electron trước redesign).
  - **Việc cần làm tiếp:** (1) hỏi user chọn phương án A hay B (hoặc đề xuất thêm), (2) sửa `public/atom-icon.svg` theo tham số đã chốt, (3) tạo lại script `export-icons.mjs` (mẫu ở dưới) để regenerate toàn bộ `src-tauri/icons/*` + `public/atom-icon.png`, (4) `cargo clean -p atomic` rồi `npm run tauri dev` để rebuild sạch, verify bằng cách extract icon từ `.exe` (không cần mở app), (5) **quan trọng: phải release + cài bản installer thật rồi mới kết luận** — icon trên taskbar của app đã cài (pinned) khác với dev exe, cần test đúng bản cài đặt thật trước khi coi là đã xong.
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

**QUAN TRỌNG — icon không tự nhúng lại khi chỉ sửa file ảnh:** Nếu `npm run tauri dev` đang chạy sẵn (watcher live), ghi đè file trong `src-tauri/icons/` sẽ tự trigger rebuild (build.rs rerun-if-changed bắt được). Nhưng nếu **restart** `npm run tauri dev` từ đầu (kill rồi chạy lại) mà không có gì trong `src-tauri/src/` thay đổi, Cargo có thể coi là "nothing to do" (~0.4s, không compile) và **giữ nguyên icon cũ đã link trong binary trước đó** — vì `tauri.conf.json` (thứ build.rs thực sự theo dõi) không đổi, chỉ nội dung icon file đổi. Cách fix chắc chắn: `cd src-tauri && cargo clean -p atomic` rồi chạy lại `npm run tauri dev` (rebuild đầy đủ ~20-25s). Cách verify nhanh không cần mở app: extract icon trực tiếp từ exe bằng PowerShell `[System.Drawing.Icon]::ExtractAssociatedIcon("src-tauri\target\debug\atomic.exe")`.

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
- ✅ Seed data giả để test UI — `seedJournalIfEmpty()` trong `journalDb.ts`, gọi từ `JournalView.tsx`

## Background Settings (Custom Wallpaper + Glass UI)

### Mô tả
Settings → tab "Hình nền": chọn ảnh từ máy → dùng làm background toàn app, có toggle bật/tắt + slider opacity (0-100%, điều khiển độ mờ của chính ảnh). Size luôn là `cover` (không có lựa chọn khác). Panel chính (topbar, sidebar phụ từng tab, kanban column, goal card, calendar canvas...) chuyển sang hiệu ứng kính mờ (glass) khi bật nền — tái dùng token `--bg-glass`/`--bg-glass-2` đã có sẵn (vốn dùng cho `.modal`), không phải thiết kế mới.

### Lưu trữ — khác với Books cover (base64 trong SQLite)
Ảnh được nén/resize qua canvas (`backgroundImage.ts`, giống hệt `compressCoverImage` trong `BooksView.tsx` nhưng `MAX_BG_DIM=2560`, JPEG quality 0.85) rồi ghi thành **file thật** `background_image.jpg` trong `%APPDATA%\com.atomic.app\` qua `tauri-plugin-fs` (`writeFile`/`readFile`/`remove`, `BaseDirectory.AppData`). Đây là lựa chọn có chủ đích của user, không phải bug — do đó ảnh nền **không** nằm trong JSON export/import backup.
`backgroundEnabled` + `backgroundOpacity` lưu `localStorage` (giống `uiScale`/`accentColor`). `backgroundImageUrl` (blob URL) **không** persist — được dựng lại mỗi lần mở app bằng `loadBackgroundImage()` (đọc file AppData → `Blob` → `URL.createObjectURL`).

### Plugin mới
`tauri-plugin-fs` (Cargo.toml + `lib.rs` `.plugin(tauri_plugin_fs::init())` + `capabilities/default.json` — 4 permission `fs:allow-write-file`/`read-file`/`exists`/`remove`, scope `$APPDATA/*`). Không cần `tauri-plugin-dialog` — tái dùng pattern `<input type="file">` ẩn đã có sẵn trong `SettingsModal.tsx` (giống JSON import).

### CSS — glass mode
Toggle qua class `html.has-bg-image` (set trong `App.tsx` dựa trên `backgroundEnabled && !!backgroundImageUrl`). Toàn bộ rule nằm trong 1 block cuối `App.css` ("Background Image / Glass Mode"), **thuần additive** — không sửa rule cũ nào, nên khi tắt nền mọi thứ y hệt trước đây.
- **Blur thật** (`backdrop-filter: blur(20px) saturate(180%)`) chỉ đặt ở 2 nơi: `.main-wrap` + `.sidebar` (topbar) — đây là "canvas" chung của mọi tab.
- **Tint-only** (chỉ đổi màu, KHÔNG thêm `backdrop-filter`) cho các panel con nằm trên canvas đã blur sẵn: `.today-sidebar`, `.today-right`, `.kanban-column`, `.goal-card`, `.journal-sidebar`, `.quotes-sidebar`, `.books-sidebar`, `.cal-wrap` + các class `.rbc-*` của react-big-calendar. Lý do: `backdrop-filter` tốn GPU, áp lên hàng chục card/cell cùng lúc (vd. nhiều goal-card trên kanban) sẽ giật — tint-only vẫn nhìn "kính" vì nó chồng lên lớp đã blur phía dưới, mà gần như miễn phí về hiệu năng.
- **Token riêng cho panel, KHÔNG dùng `--bg-glass`/`--bg-glass-2` gốc:** `--bg-glass-panel`/`--bg-glass-panel-2` (opacity 0.9, định nghĩa cạnh `--bg-glass` gốc trong `:root`/`[data-theme="dark"]`). Lý do phải tách riêng (bug thật đã gặp, fix ngày 2026-07-16): `.modal` dùng `--bg-glass` (0.72) OK vì nó luôn nằm trên `.modal-overlay` — một lớp scrim đen `rgba(0,0,0,0.3)` đã làm tối nền phía sau trước rồi. Các panel nền ảnh (kanban column, goal card...) thì KHÔNG có lớp scrim đó, nằm trực tiếp trên ảnh gốc — nên 0.72 không đủ, chữ bị mờ/khó đọc ở vùng ảnh sáng/nhiều màu. Nếu sau này thêm panel glass mới, dùng `--bg-glass-panel(-2)`, đừng dùng lại `--bg-glass` gốc.
- Các phần tử nhỏ (button, input, dropdown item, badge, `.task-item`) **giữ nguyên đặc màu** — không đụng, giống cách `.modal` hiện tại vẫn đặc màu ở input/button bên trong dù modal ngoài là kính mờ.

### Files đã sửa
- `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json` — plugin fs
- `package.json` — `@tauri-apps/plugin-fs`
- `src/store/backgroundImage.ts` — helper nén ảnh (canvas) + decode data URL → bytes
- `src/store/appStore.ts` — state (`backgroundEnabled`, `backgroundOpacity`, `backgroundImageUrl`) + actions (`loadBackgroundImage`, `setBackgroundImage`, `removeBackgroundImage`, `setBackgroundOpacity`, `setBackgroundEnabled`)
- `src/App.tsx` — load on mount, toggle `has-bg-image` class, render `.app-bg-image-layer`
- `src/App.css` — section "Background Image / Glass Mode" (cuối file) + `.settings-bg-preview`
- `src/components/SettingsModal.tsx` — tab "Hình nền" (toggle, chọn ảnh, preview, opacity slider, remove)
- `src/i18n/vi.ts` + `en.ts` — key `background*`

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
