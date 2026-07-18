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

**Refactor lớn 2026-07-18** (xem `feedback_patterns.md` memory): App.css (11.3k dòng) → tách theo feature; `appStore.ts` (1.8k dòng) → tách slice Zustand; `ProjectsView.tsx`/`BooksView.tsx`/`SettingsModal.tsx` → tách subcomponent theo modal/tab. Quy tắc từ giờ: **CSS mới của 1 feature nằm cạnh component đó** (`components/<feature>/<feature>.css`, tự `import` trong file `.tsx` chính, không thêm vào `App.css` — `App.css` giờ chỉ chứa style dùng chung ≥2 feature), và **modal/card lớn tách riêng file** thay vì viết nội tuyến trong view chính.

```
atomic/
├── .github/workflows/release.yml   # GitHub Actions: build + upload khi push tag v*.*.*
├── src-tauri/src/
│   ├── main.rs          # Entry point (không sửa)
│   ├── lib.rs           # Plugin registration + DB migrations + tray setup
│   └── tray.rs          # System tray icon + menu
└── src/
    ├── App.tsx           # Root: theme, tab routing, DndContext, auto-update, DeleteToast
    ├── App.css           # CHỈ style dùng chung (variables, layout, modal, form, dropdown...) — style riêng feature nằm trong components/<feature>/*.css
    ├── types/index.ts    # TypeScript interfaces
    ├── utils/imageUtils.ts  # Helper ảnh dùng chung: loadImageFromFile/resizeImageToDataUrl/compressImageToDataUrl/formatISODate (Books/Projects cover + background wallpaper đều gọi vào đây)
    ├── store/
    │   ├── appStore.ts   # Chỉ compose slice: create<AppState>((...a) => ({...createXSlice(...a), ...}))
    │   ├── db.ts          # getDb() singleton (SQLite connection) dùng chung mọi slice
    │   ├── slices/        # uiSlice / backgroundSlice / tagSlice / taskSlice / goalSlice / heatmapSlice / dataSlice — mỗi slice tự export interface + createXSlice, xem Zustand slices pattern
    │   └── journalDb.ts   # Journal DB functions — không dùng Zustand, self-contained
    ├── hooks/useReminder.ts  # Background reminder check mỗi phút + snooze logic
    ├── i18n/
    │   ├── vi.ts         # Tiếng Việt (source of truth cho type)
    │   ├── en.ts         # English (typeof vi)
    │   └── index.ts      # useT() hook → trả về vi hoặc en theo language state
    └── components/
        ├── Sidebar.tsx + Sidebar.css   # Nav với Tabler icons — 9 tab
        ├── ReminderPopup.tsx + .css    # In-app reminder overlay (góc phải màn hình)
        ├── DeleteToast.tsx + .css      # Toast xóa task + nút Hoàn tác (4 giây auto-confirm)
        ├── SettingsModal.tsx + .css    # Chỉ còn: modal shell, tab bar, custom color picker popup (lý do giữ ở đây thay vì GeneralTab — xem note bên dưới)
        ├── settings/                   # GeneralTab / GreetingTab / DataTab / VocabTab / BackgroundTab.tsx — mỗi tab tự đọc useAppStore()/state riêng, không prop-drill từ SettingsModal
        ├── UpdateDialog.tsx + .css     # Auto-update dialog với progress bar
        ├── today/
        │   ├── TodayView.tsx + today.css  # Layout + topbar + mini heatmap
        │   ├── TaskCard.tsx      # Card task — gọi softDeleteTask (không deleteTask)
        │   ├── AddTaskModal.tsx  # Form thêm/sửa task
        │   ├── DailyGreeting.tsx # Lời chào theo giờ
        │   └── MiniHeatmap.tsx   # Heatmap nhỏ trong TodayView
        ├── kanban/
        │   ├── KanbanView.tsx + kanban.css  # Layout kanban — không chứa DndContext
        │   ├── KanbanColumn.tsx  # Cột droppable
        │   ├── GoalCard.tsx      # Card mục tiêu draggable
        │   ├── GoalCardOverlay.tsx  # DragOverlay content (render trong App.tsx)
        │   └── AddGoalModal.tsx  # Form thêm/sửa mục tiêu
        ├── heatmap/
        │   ├── HeatmapView.tsx + heatmap.css
        │   └── HeatmapGrid.tsx
        ├── calendar/
        │   ├── CalendarView.tsx + calendar.css  # Toolbar + toggle Month/Week + load calendarTasks
        │   ├── DayView.tsx, MonthView.tsx, WeekView.tsx
        │   └── CalendarFilterSidebar.tsx, DayStatsSection.tsx
        ├── journal/
        │   └── JournalView.tsx + journal.css   # Full Journal tab: layout 2 cột, sub-components nội tuyến
        ├── quotes/
        │   └── QuotesView.tsx + quotes.css
        ├── books/
        │   ├── BooksView.tsx + books.css   # Chỉ còn layout/filter/pagination
        │   ├── BookCard.tsx, BookDetailModal.tsx, AddBookModal.tsx
        │   └── bookUtils.ts   # compressCoverImage/useCoverGlow/sortBooks/bookSortKey — dùng chung 3 file trên
        └── projects/
            ├── ProjectsView.tsx + projects.css   # Chỉ còn layout/filter/pagination — import thêm books.css vì tái dùng .books-sidebar/.books-wrap
            ├── FolderCard.tsx, AddFolderModal.tsx, ProjectCard.tsx, ProjectDetailModal.tsx, AddProjectModal.tsx
            ├── icons.tsx           # VsCodeLogoIcon/FigmaLogoIcon/PianoKeysIcon + CATEGORY_*_ICON/STATUS_ICON maps
            ├── projectImageUtils.ts  # compressProjectCover (full+thumb)/resizeCoverThumbFromDataUrl/parseCoverPosition — riêng Projects vì cần 2 size ảnh + cover-position drag, khác bookUtils.ts
            └── Pagination.tsx
```

**Note vị trí custom color picker popup:** `.color-picker-popup-wrap` dùng `position: fixed`, còn `.modal` có `backdrop-filter` — theo spec CSS, `backdrop-filter`/`filter` khác `none` tạo containing block mới cho phần tử `position:fixed` bên trong. Nếu đưa popup này vào trong cây JSX của `GeneralTab` (nằm trong `.modal`), nó sẽ bị định vị/clip theo khung modal 440px thay vì giữa viewport. Vì vậy state + JSX của popup này **cố ý giữ ở `SettingsModal.tsx`** (sibling của `.modal`, không nested), `GeneralTab` chỉ nhận callback `onCustomSwatchClick`/`onSwatchClick` để trigger. `.delete-toast` thì an toàn để nested sâu hơn vì nó dùng `position: absolute` và mọi ancestor liên quan (`.modal`, `.settings-body`, `.settings-tab-panel`) đều `position: static` — không tạo containing block mới.

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
Classes trong `components/calendar/calendar.css` (nằm cạnh `.day-context-item` gốc, xem note refactor CSS đầu file): `.task-context-menu`, `.task-context-divider`, `.task-context-colors`, `.task-context-color-btn`
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
- `src/components/calendar/calendar.css` — CSS context menu

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
Ảnh được nén/resize qua canvas (`backgroundImage.ts`, giống hệt `compressCoverImage` trong `BooksView.tsx` nhưng `MAX_BG_DIM=2560`, JPEG quality 0.85) rồi ghi thành **file thật** trong subfolder `%APPDATA%\com.atomic.app\background\` qua `tauri-plugin-fs` (`writeFile`/`readFile`/`remove`, `BaseDirectory.AppData`). Đây là lựa chọn có chủ đích của user, không phải bug — do đó ảnh nền **không** nằm trong JSON export/import backup.
`backgroundEnabled` + `backgroundOpacity` lưu `localStorage` (giống `uiScale`/`accentColor`). `backgroundImageUrl` (blob URL) **không** persist — được dựng lại mỗi lần mở app bằng `loadBackgroundImage()` (đọc file AppData → `Blob` → `URL.createObjectURL`).
- **Subfolder `background/`** (đổi 2026-07-16, ban đầu file nằm thẳng ở root AppData): `backgroundImage.ts` export `BG_DIR="background"`.
- **Giữ nguyên tên file gốc + không ghi đè ảnh cũ** (đổi 2026-07-16, session sau — trước đó luôn ghi đè vào 1 tên cố định `background_image.jpg`): `setBackgroundImage(file)` lấy `file.name` gốc → `safeBackgroundFilename()` (chỉ escape ký tự Windows cấm: `\/:*?"<>|`, KHÔNG đổi đuôi — file JPEG thật có thể mang đuôi `.png` nếu ảnh gốc là png, vô hại vì mọi chỗ đọc lại đều gán cứng `type: 'image/jpeg'`) → `uniqueBackgroundFilename()` kiểm tra `exists()` trên `background/<tên>`, nếu trùng thì thêm hậu tố ` (1)`, ` (2)`... trước phần đuôi, **không bao giờ overwrite**. Ảnh đang active track qua `localStorage.backgroundActiveFilename` (thay cho flag boolean `backgroundHasImage` cũ). Kết quả: mỗi lần chọn ảnh nền mới, ảnh cũ vẫn nằm nguyên trong thư mục `background/` với tên gốc, chỉ có con trỏ "đang dùng" đổi sang file mới.
  - `removeBackgroundImage()` (nút xóa/tắt nền) **chỉ xóa file đang active** — các ảnh cũ hơn (không active) không bị đụng tới.
  - `loadBackgroundImage()` có logic **migrate 1 lần** cho user đã có ảnh từ các bản trước `backgroundActiveFilename`: đọc flag cũ `backgroundHasImage`, thử `background/background_image.jpg` (`LEGACY_BG_FILENAME`), rồi thử tiếp bare `background_image.jpg` ở root AppData (bản còn cũ hơn nữa, trước khi có subfolder) — có thì di chuyển vào đúng vị trí mới rồi gán làm active.
  - **Chưa có UI để chọn lại 1 ảnh cũ trong lịch sử** — hiện chỉ có thể xem/chọn lại thủ công qua nút "Mở thư mục chứa ảnh" rồi chọn lại file đó qua dialog "Chọn ảnh". Nếu cần gallery chọn nhanh trong app thì phải làm thêm.
- **Nút "Mở thư mục chứa ảnh"** trong tab Hình nền (`SettingsModal.tsx`, chỉ hiện khi có `backgroundImageUrl`) → action `openBackgroundImageFolder` trong `appStore.ts`, dùng `revealItemInDir` từ `@tauri-apps/plugin-opener` (đã có sẵn trong `opener:default` permission set, KHÔNG cần thêm capability cho opener) trỏ tới file đang active, nối path bằng `join(await appDataDir(), BG_DIR, filename)`.

### Plugin mới
`tauri-plugin-fs` (Cargo.toml + `lib.rs` `.plugin(tauri_plugin_fs::init())` + `capabilities/default.json` — permission `fs:allow-write-file`/`read-file`/`exists`/`remove`/`mkdir`, scope gồm cả `$APPDATA/*` (root, cần cho bước migrate đọc/xóa file cũ) và `$APPDATA/background/*` (vị trí mới) — **lưu ý:** scope glob của Tauri dùng `require_literal_separator: true` nên `$APPDATA/*` KHÔNG match path 2 cấp như `background/background_image.jpg`, phải khai riêng, không dùng `**` biến 1 pattern thành match-tất-cả vì phá nguyên tắc least-privilege). Không cần `tauri-plugin-dialog` — tái dùng pattern `<input type="file">` ẩn đã có sẵn trong `SettingsModal.tsx` (giống JSON import).

### CSS — glass mode
Toggle qua class `html.has-bg-image` (set trong `App.tsx` dựa trên `backgroundEnabled && !!backgroundImageUrl`). Toàn bộ rule nằm trong 1 block cuối `App.css` ("Background Image / Glass Mode"), **thuần additive** — không sửa rule cũ nào, nên khi tắt nền mọi thứ y hệt trước đây.
- **Blur thật** (`backdrop-filter: blur(20px) saturate(180%)`) chỉ đặt ở 2 nơi: `.main-wrap` + `.sidebar` (topbar) — đây là "canvas" chung của mọi tab.
- **Tint-only** (chỉ đổi màu, KHÔNG thêm `backdrop-filter`) cho các panel con nằm trên canvas đã blur sẵn (danh sách đầy đủ, audit lại + mở rộng 2026-07-16 — xem "Audit toàn view" bên dưới): `.today-sidebar`, `.today-right`, `.kanban-column`, `.kanban-stats-bar`, `.journal-sidebar`, `.quotes-sidebar`, `.books-sidebar` (Projects tái dùng class này), `.stat-card`, `.stat-card-sm`, `.heatmap-month-summary`, `.weekly-strip-cell`, `.jsc-streak`, `.cal-wrap`, `.journal-view`, `.cal-main`, `.cal-week-grid`, `.cal-day-sidebar`, `.cal-filter-sidebar`, `.cal-month-grid`, `.cal-month-dow-row`, `.cal-month-day-cell` (+ `.off-range`), `.cal-week-col` (+ `.cal-week-header`, `.cal-week-stats` bên trong), `.day-grid`, `.day-gutter`, `.day-deck-row`, `.books-goal-card`, `.books-search-input`, `.books-sort-select` (`.books-search-input`/`.books-sort-select` cũng dùng chung ở Projects tab). Lý do: `backdrop-filter` tốn GPU, áp lên hàng chục card/cell cùng lúc sẽ giật — tint-only vẫn nhìn "kính" vì nó chồng lên lớp đã blur phía dưới, mà gần như miễn phí về hiệu năng.
- **Ngoại lệ đã cố ý tint cả input/select** (`.books-search-input`, `.books-sort-select`, theo yêu cầu cụ thể của user ngày 2026-07-16) — đi ngược quy tắc chung bên dưới ("phần tử nhỏ giữ đặc màu"), nhưng đây là lựa chọn thẩm mỹ user chủ động chọn cho riêng 2 class này, không tự ý mở rộng sang input/select khác trong app nếu không được yêu cầu.
- **KHÔNG tint `.goal-card`** (đã sửa lại note sai ngày 2026-07-16 — bản ghi cũ liệt kê nhầm `.goal-card` vào danh sách tint-only, nhưng `GoalCard.tsx` luôn set `style={{ backgroundColor: cardBg }}` = màu category qua inline style, nên card này **luôn đặc màu theo category, không bao giờ neutral** — tint sẽ phá mất color-coding). Cùng lý do, các card có màu/ảnh riêng theo item (task card màu theo category/custom color, book cover, quote card, project folder cover) đều **không** tint — chỉ tint panel/card trung tính dùng `--bg-primary`/`--bg-secondary` trơn.
- **Token riêng cho panel, KHÔNG dùng `--bg-glass`/`--bg-glass-2` gốc:** `--bg-glass-panel`/`--bg-glass-panel-2` (opacity 0.9, định nghĩa cạnh `--bg-glass` gốc trong `:root`/`[data-theme="dark"]`). Lý do phải tách riêng (bug thật đã gặp, fix ngày 2026-07-16): `.modal` dùng `--bg-glass` (0.72) OK vì nó luôn nằm trên `.modal-overlay` — một lớp scrim đen `rgba(0,0,0,0.3)` đã làm tối nền phía sau trước rồi. Các panel nền ảnh (kanban column...) thì KHÔNG có lớp scrim đó, nằm trực tiếp trên ảnh gốc — nên 0.72 không đủ, chữ bị mờ/khó đọc ở vùng ảnh sáng/nhiều màu. Nếu sau này thêm panel glass mới, dùng `--bg-glass-panel(-2)`, đừng dùng lại `--bg-glass` gốc.
- Các phần tử nhỏ (button, input, dropdown item, badge, `.task-item`) **giữ nguyên đặc màu** — không đụng, giống cách `.modal` hiện tại vẫn đặc màu ở input/button bên trong dù modal ngoài là kính mờ. (Ngoại lệ riêng cho Books search/sort — xem ngay trên.)

### Audit toàn view — panel còn thiếu kính mờ (fix 2026-07-16)
User báo `stats-row` sidebar Today chưa kính mờ → audit lan ra toàn app, phát hiện 2 loại lỗ hổng thật:
1. **`.stat-card` (Today + Heatmap dùng chung class)**: nằm trong panel đã tint (`.today-sidebar`) hoặc trực tiếp trên canvas blur (`.view-content` của Heatmap) nhưng tự nó vẫn `background: var(--bg-secondary)` cứng → chặn hết hiệu ứng. Cùng bệnh: `.stat-card-sm`, `.heatmap-month-summary`, `.weekly-strip-cell` (Heatmap), `.jsc-streak` (Journal sidebar), `.kanban-stats-bar` (Kanban header).
2. **Calendar gần như KHÔNG có kính mờ nào hoạt động**: block override gốc nhắm vào class của `react-big-calendar` (`.rbc-month-view`, `.rbc-day-bg`...) nhưng **thư viện này không được dùng** — `MonthView.tsx`/`WeekView.tsx`/`DayView.tsx` là component tự viết (`CalendarView.tsx` chỉ import 3 file này, không có `react-big-calendar` ở đâu cả). Toàn bộ selector đó là dead code không match gì trong DOM thật. Đã thay bằng đúng class thật: `.cal-main`, `.cal-day-sidebar`, `.cal-filter-sidebar` (2 sidebar của Calendar, trước đó hoàn toàn chưa tint), `.cal-month-grid`/`.cal-month-dow-row`/`.cal-month-day-cell` (Month view), `.cal-week-header`/`.cal-week-stats` trong `.cal-week-col` (Week view), `.day-grid`/`.day-gutter`/`.day-deck-row` (Day view).
- **Đã dọn (2026-07-18, refactor CSS split):** khối `.rbc-*` dead code nói trên (37 rule, tàn dư react-big-calendar) đã bị xóa hẳn khi tách `App.css` thành `components/<feature>/*.css` — verify bằng cách so brace-count selector giữa file gốc và file tách, chỉ lệch đúng 37 rule `.rbc-*`, không rule thật nào bị mất.
- Projects tab không cần sửa riêng vì tái dùng class `.books-sidebar`/`.books-wrap` (chỉ thêm modifier `.projects-sidebar` không đụng `background`) nên tự động ăn theo fix của Books.

### Files đã sửa
- `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json` — plugin fs
- `package.json` — `@tauri-apps/plugin-fs`
- `src/store/backgroundImage.ts` — helper nén ảnh (canvas) + decode data URL → bytes
- `src/store/appStore.ts` — state (`backgroundEnabled`, `backgroundOpacity`, `backgroundImageUrl`) + actions (`loadBackgroundImage`, `setBackgroundImage`, `removeBackgroundImage`, `setBackgroundOpacity`, `setBackgroundEnabled`)
- `src/App.tsx` — load on mount, toggle `has-bg-image` class, render `.app-bg-image-layer`
- `src/App.css` — section "Background Image / Glass Mode" (cuối file, global/cross-cutting nên vẫn ở đây sau refactor CSS split)
- `src/components/SettingsModal.css` — `.settings-bg-preview`
- `src/components/SettingsModal.tsx` — tab "Hình nền" (toggle, chọn ảnh, preview, opacity slider, remove)
- `src/i18n/vi.ts` + `en.ts` — key `background*`

### "Độ trong suốt giao diện" slider (uiTransparency, thêm 2026-07-16)

**Vấn đề gốc:** user chỉnh "Background opacity" (độ mờ ảnh) lên 100% mà vẫn không thấy rõ ảnh nền, vì slider đó chỉ chỉnh opacity của `.app-bg-image-layer` (lớp ảnh raw) — trong khi `.sidebar` + `.main-wrap` phủ kín 100% viewport (không hề có khe hở) với `background: var(--bg-glass-panel)` (alpha cố định 0.9) + `backdrop-filter: blur(20px)` cố định, không liên quan gì đến slider opacity. Nên dù ảnh gốc đục 100%, người dùng luôn nhìn nó qua lớp phủ 90% đục + blur 20px không đổi.

**Fix:** thêm slider thứ 2 độc lập, đặt ngay dưới "Background opacity" trong tab Hình nền, điều khiển alpha + blur của chính lớp kính đó (0 = giữ nguyên UI cũ hệt như trước, alpha 0.9/blur 20px; 100 = filter tắt hoàn toàn, alpha 0/blur 0px).

- `--bg-glass-panel-alpha` (default `0.9`) + `--bg-glass-blur` (default `20px`) + `--bg-glass-saturate` (default `180%`, thêm 2026-07-16 session sau — xem bug ngay dưới) định nghĩa ở `:root` đầu `App.css`, dùng thay literal trong: `--bg-glass-panel`/`--bg-glass-panel-2` (rgba alpha channel) và `backdrop-filter: blur(...) saturate(...)` của `.main-wrap`/`.sidebar` trong block "Background Image / Glass Mode". **KHÔNG đụng** `--bg-glass`/`--bg-glass-2` gốc (dùng cho `.modal`) — 2 hệ token tách biệt như đã note ở trên.
- `appStore.ts`: state `uiTransparency` (0-100, localStorage key `uiTransparency`, default `'0'` để không đổi visual của user cũ) + action `setUiTransparency`.
- `App.tsx`: `useEffect([uiTransparency])` map slider → `alpha = 0.9*(1-t)`, `blur = 20*(1-t)`, `saturate = 180 - 80*t` (t = uiTransparency/100) rồi `style.setProperty` 3 biến trên `documentElement`. **Bài học:** lần đầu implement tôi đặt sàn (alpha 0.25/blur 2px) ở t=1 "để giữ chữ dễ đọc" mà không hỏi user — user phản hồi ngay là kéo max 2 slider vẫn không nét như ảnh gốc, vì tên "trong suốt" ngụ ý 100% = không lọc gì cả. Đã bỏ sàn, để user tự cân bằng rõ/dễ đọc bằng chính slider thay vì áp đặt giới hạn ẩn.
- **Bug thật (fix 2026-07-16, session sau):** `saturate(180%)` trong `backdrop-filter` của `.main-wrap`/`.sidebar` bị hard-code cứng ngay từ lần implement đầu — KHÔNG nằm trong biến nào, nên không scale theo slider như `blur` đã làm. User báo chọn cả "Background opacity" lẫn "UI transparency" đều 100% mà màu ảnh nền vẫn khác ảnh gốc (rực/sạm hơn); vì dù `blur` đã về đúng 0px, trình duyệt vẫn áp `saturate(180%)` (không phải "tắt" thật như comment cũ mô tả) lên bất kỳ thứ gì hiện phía sau — đẩy độ bão hòa màu của cả ảnh nền lên 1.8 lần. Fix: thêm `--bg-glass-saturate` scale cùng công thức tuyến tính với `alpha`/`blur` (180% ở t=0 → 100% ở t=1, tức "không boost màu" khi user muốn ảnh hiện nguyên bản).
- `SettingsModal.tsx` + `i18n` (`backgroundUiTransparency` + `backgroundUiTransparencyDesc`): slider y hệt pattern `backgroundOpacity` (chỉ hiện khi có `backgroundImageUrl`).
- **Giới hạn chất lượng riêng, không liên quan slider:** ảnh nền còn bị nén khi lưu (`backgroundImage.ts` — resize tối đa `MAX_BG_DIM=2560`px cạnh dài + JPEG quality `0.85`), nên trên màn hình >2560px hoặc scale cao, ảnh vẫn mờ hơn gốc dù cả 2 slider đều 100%. Chưa đổi 2 tham số này — cần hỏi user trước vì tăng lên đổi tradeoff dung lượng file AppData + bộ nhớ.
- Verify: `tsc --noEmit` sạch; dev server Tauri của user đã chạy sẵn trên port 1420 lúc code — confirm qua curl là HMR nhận đúng CSS/TSX mới (chưa tự mắt thấy trong app thật, vì không có tool screenshot cho native WebView2 window trong môi trường này).

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

**Keyframes dùng chung (nằm trong `components/today/today.css` — dù nhiều tab khác dùng, keyframes CSS là global nên vẫn hoạt động vì mọi view đều import tĩnh, không lazy-load):**
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
/* Trong components/<feature>/<feature>.css của tab đó (không phải App.css — xem note refactor CSS đầu file) */
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
