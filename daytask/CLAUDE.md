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

## Trạng thái build (tính đến 2026-06-01)

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
| 13 | Fix drag-drop lệch khi zoom != 100% | ✅ Fix đúng (session 2026-06-01b) — dùng NATIVE webview zoom, bỏ hết transform:scale(). Cần verify runtime |
| 14 | Bảng màu danh mục chuẩn Google Calendar | ✅ Xong (session 2026-06-01) — 24 màu, 6 cột × 4 hàng. Cần verify visual |

## Tính năng đã có (sau session 2026-06-01)
- **Tabler Icons** (`@tabler/icons-react`): toàn bộ UI dùng SVG icon, không còn emoji/text symbol
- **Inline task editing**: double-click tên task → sửa trực tiếp (không mở modal)
- **ReminderPopup in-app**: popup góc phải khi đến giờ nhắc, có nút "Dời 10 phút" + "Bỏ qua" + "Xem"
- **Snooze reminder**: state lưu trong Zustand (`snoozedUntil: Record<number, number>`)
- **Export JSON**: nút download ở topbar TodayView → xuất tasks ngày hiện tại ra `.json`
- **Kanban stats bar**: bar dưới topbar hiện số lượng từng cột + progress bar % năm
- **Column icons**: mỗi cột Kanban có icon riêng (circle-dashed, loader, eye, circle-check)
- **Bảng màu danh mục**: 24 màu chuẩn Google Calendar, grid 6×4

## Bảng màu danh mục — COLOR_PALETTE (session 2026-06-01)

Định nghĩa tại `AddTaskModal.tsx:6` và `AddGoalModal.tsx:6` (cả hai giống nhau).
CSS: `.cat-color-popup` và `.cat-color-picker` dùng `grid-template-columns: repeat(6, 20px)`.

```
Hàng 1 (nhạt/ấm):   #F28B82  #FAAFA8  #FF8A65  #FDD835  #CDDC39  #7CB342
Hàng 2 (chuẩn/ấm):  #D50000  #E67C73  #F4511E  #F6BF26  #33B679  #0B8043
Hàng 3 (lạnh):      #4DB6AC  #039BE5  #3F51B5  #7986CB  #8E24AA  #7B1FA2
Hàng 4 (tím/xám):   #AB47BC  #CE93D8  #78909C  #9E9E9E  #616161  #546E7A
```

**Lý do chọn 6×4:** Ảnh gốc Google Calendar có đúng 4 hàng × 6 màu = 24 màu.
**Lý do không dùng 5×4 (20 màu):** Thiếu cột, không đủ dải màu đặc trưng của GCal.

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

## Bug drag-drop — FIX ĐÚNG (2026-06-01b): NATIVE WEBVIEW ZOOM

### Root cause thật sự (đã sai ở các lần trước)

Mọi fix trước thất bại vì cùng dùng `transform: scale()` để scale UI. `transform: scale()` gây **2 bug** cho @dnd-kit, không thể fix triệt để:
1. **Card phình to:** DragOverlay lấy `getBoundingClientRect()` của card gốc (đã scale → 264px) làm width wrapper, rồi code lại bọc thêm `scale(1.1)` → 264×1.1 ≈ 290px. Double-scale.
2. **Drop sai vị trí:** @dnd-kit tính delta kéo + transform sắp xếp bằng viewport px THÔ, rồi áp ngược vào element nằm TRONG `scale(1.1)` → translate 264px thành 290px visual. Collision detection lệch theo đúng hệ số scale. **Bug cố hữu của transform:scale — không sửa được khi draggable nằm trong scaled ancestor.**

### Giải pháp đúng: native webview zoom (KHÔNG transform:scale)

Tauri v2 zoom toàn webview ở tầng browser (`getCurrentWebview().setZoom(uiScale)`), giống Ctrl-+. Zoom xảy ra DƯỚI tầng toạ độ DOM → `getBoundingClientRect`/`clientX` đều nhất quán → @dnd-kit chạy đúng 100%, không cần xử lý đặc biệt.

**Đã implement (2026-06-01b):**
- `App.tsx`: bỏ scale wrapper + bỏ `scale()` quanh DragOverlay content. Thêm `useEffect([uiScale])` gọi `getCurrentWebview().setZoom(uiScale)` (Tauri) / `document.documentElement.style.zoom` (browser fallback).
- `capabilities/default.json`: thêm `core:webview:allow-set-webview-zoom`.
- DndContext vẫn bọc toàn app (cho tiện), nhưng giờ KHÔNG còn ancestor transform nào.
- Typecheck PASS. **CẦN restart `npm run tauri dev`** (đổi capabilities) rồi kéo thử ở uiScale 1.1/1.25.

### (Lịch sử cũ) Root cause xác nhận (đọc source @dnd-kit v6.3.1)

`DragOverlay` trong @dnd-kit **KHÔNG dùng React portal**. Nó render INLINE trong React tree, bên trong `DndContext`. Nó dùng:
```
position: fixed; top: rect.top; left: rect.left; transform: translate(delta_x, delta_y)
```

Vì `DragOverlay` nằm TRONG scale wrapper (`transform: scale(1.1)`), `position: fixed` bị positioned relative to wrapper (không phải viewport). Kết quả:
- `top: 110px` CSS → hiển thị ở viewport `110 × 1.1 = 121px` → lệch 10%
- `translate(100px)` CSS → di chuyển viewport `100 × 1.1 = 110px` → drift

### Lịch sử các fix đã thử — TẤT CẢ ĐỀU THẤT BẠI

| Session | Fix thử | Kết quả |
|---------|---------|---------|
| 2026-05-31 | `measuring` + `modifier` /uiScale trên `DndContext` | THẤT BẠI (lý do chưa rõ) |
| 2026-06-01 (sáng) | `transform: scale()` wrapper thay `zoom` + scale DragOverlay content | THẤT BẠI: vị trí vẫn sai, card phình to x1.21 |
| 2026-06-01 (tối) | Revert scale trên DragOverlay content | Đã revert — card không phình nữa, nhưng vị trí vẫn sai |

**Trạng thái hiện tại (sau session 2026-06-01 tối):**
- `App.tsx`: dùng `transform: scale(uiScale)` wrapper (KHÔNG dùng `document.documentElement.style.zoom`)
- `App.css`: `.app-shell { height: 100% }` + `html, body, #root { height: 100%; overflow: hidden }`
- `KanbanView.tsx`: DragOverlay render bình thường (không có extra scale)
- **Vấn đề còn lại:** DragOverlay vẫn lệch vì nằm trong scale wrapper

### ✅ ĐÃ IMPLEMENT (session 2026-06-01) — Đưa DndContext ra NGOÀI scale wrapper

Đã làm xong theo đúng plan dưới đây. Tóm tắt thay đổi:
- `appStore.ts`: thêm `kanbanDragActiveId: number | null` + `setKanbanDragActiveId`
- `App.tsx`: `DndContext` (sensors, `closestCenter`, handlers `handleDragStart/End/Over`, dùng `moveGoal`) bọc cả scale wrapper. `DragOverlay` render NGOÀI scale wrapper, content bọc `transform: scale(uiScale)` để khớp kích thước card gốc.
- `KanbanView.tsx`: bỏ hết `DndContext`/`DragOverlay`/sensors/drag handlers — chỉ còn render stats bar, drag hint, columns, modal. Giữ `openAdd`/`openEdit` (modal state local).
- Typecheck (`tsc --noEmit`) PASS. **Chưa verify runtime** (`npm run tauri dev` để kéo thử ở uiScale 1.1).

### Fix đúng duy nhất — Đưa DndContext ra NGOÀI scale wrapper

**Lý do:** Nếu `DndContext` (và `DragOverlay` bên trong nó) nằm NGOÀI `transform: scale(uiScale)` wrapper:
- DragOverlay render trong context KHÔNG có transform → CSS px = viewport px
- BCR của cards trong wrapper = viewport px (BCR luôn tính transform)  
- `clientX/Y` = viewport px
- → Tất cả cùng coordinate space → không có mismatch → DragOverlay vị trí đúng ✓

**Cách implement:**

**Bước 1 — Thêm drag state vào Zustand store (`appStore.ts`):**
```typescript
// Thêm vào state:
kanbanDragActiveId: number | null;
// Thêm action:
setKanbanDragActiveId: (id: number | null) => set({ kanbanDragActiveId: id });
```

**Bước 2 — Tái cấu trúc `KanbanView.tsx`:**
- XÓA `DndContext` và `DragOverlay` khỏi KanbanView
- KanbanView chỉ render columns, stats bar, drag hint, modal
- Export handlers: `handleDragStart`, `handleDragEnd`, `handleDragOver`, `sensors`
  hoặc đặt chúng trong store/context

**Bước 3 — Sửa `App.tsx` — đưa `DndContext` ra ngoài scale wrapper:**
```tsx
// App.tsx — structure mới:
function App() {
  const { uiScale, goals, moveGoal, kanbanDragActiveId, setKanbanDragActiveId } = useAppStore();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  
  const overlayGoal = kanbanDragActiveId
    ? (goals.find((g) => g.id === kanbanDragActiveId) ?? null)
    : null;

  function handleDragStart(event: DragStartEvent) {
    setKanbanDragActiveId(Number(event.active.id));
  }
  function handleDragEnd(event: DragEndEvent) { /* ... move logic ... */ }
  function handleDragOver(event: DragOverEvent) { /* ... */ }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragOver={handleDragOver}>
      {/* Scale wrapper — DndContext là parent, NGOÀI wrapper này */}
      <div style={{ transform: `scale(${uiScale})`, transformOrigin: 'top left',
                    width: `calc(100vw / ${uiScale})`, height: `calc(100vh / ${uiScale})` }}>
        <div className="app-shell">
          ...tabs...
        </div>
      </div>
      {/* DragOverlay nằm NGOÀI scale wrapper — CSS px = viewport px → không lệch */}
      <DragOverlay dropAnimation={...}>
        {overlayGoal ? (
          <div style={{ transform: `scale(${uiScale})`, transformOrigin: 'top left' }}>
            <GoalCardOverlay goal={overlayGoal} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
```

**Bước 4 — Sửa `KanbanView.tsx`:**
```tsx
// KanbanView chỉ còn render UI, không có DndContext/DragOverlay
export default function KanbanView() {
  return (
    <>
      <div className="kanban-stats-bar">...</div>
      <div className="kanban-drag-hint">...</div>
      <div className="kanban-board">
        {STATUSES.map((status) => (
          <KanbanColumn key={status} status={status} ... />
        ))}
        {/* KHÔNG có DndContext hay DragOverlay ở đây */}
      </div>
      {showModal && <AddGoalModal />}
    </>
  );
}
```

**Lưu ý quan trọng khi implement:**
- `DndContext` cần `import` ở `App.tsx` cùng với `DragStartEvent`, `DragEndEvent`, `DragOverEvent`
- `sensors` (`useSensors`, `useSensor`, `PointerSensor`) cần move lên `App.tsx`
- Move logic `handleDragEnd` (gọi `moveGoal`) và `handleDragOver` lên `App.tsx`
- `DragOverlay` trong `App.tsx` cần `GoalCardOverlay` và `defaultDropAnimationSideEffects`
- `DndContext` ở App.tsx được mount lúc nào cũng được (không ảnh hưởng tab Today/Heatmap)
- Sau fix: DragOverlay nằm ngoài scale wrapper → thêm `transform: scale(uiScale)` vào content để khớp kích thước card gốc (lần này đúng vì context không bị double-scale)

**uiScale default là `1.1`** — xem `appStore.ts`.

---

## Lưu ý quan trọng
- **Icons:** Dùng `@tabler/icons-react` — KHÔNG dùng webfont hay emoji. Import từng icon: `import { IconSun } from '@tabler/icons-react'`
- **Capabilities:** Dùng `sql:allow-execute`, `sql:allow-select`, `sql:allow-load` — KHÔNG dùng `sql:default`
- **PATH issue:** Bash terminal không thấy `cargo`. Luôn dùng PowerShell
- **Capabilities thay đổi** → cần restart `npm run tauri dev`
- **Reminder snooze:** State lưu trong `appStore.snoozedUntil` (Record<number, number>), KHÔNG phải localStorage
- **Inline edit:** double-click task name để sửa nhanh; single click mở modal
- **Export:** dùng Blob + URL.createObjectURL — không cần plugin Tauri fs/dialog
- **Git branch:** `main` (không phải master)
- **DB file:** `%APPDATA%\com.daytask.app\daytask.db`
