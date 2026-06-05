# DayTask — Project Brief v2
**Tech stack: Tauri + React + TypeScript + SQLite**

> Paste file này vào Claude Code trong VSCode và nói:
> **"Đọc file DAYTASK_PROJECT_BRIEF_v2.md và bắt đầu xây dựng app theo đúng spec, làm từng bước theo thứ tự build ở phần cuối file."**

---

## 1. Cài môi trường (làm 1 lần duy nhất)

### Bước 1 — Cài Node.js
- Tải tại: https://nodejs.org (chọn bản LTS)
- Kiểm tra: mở Terminal gõ `node -v` và `npm -v`

### Bước 2 — Cài Rust
- Tải tại: https://rustup.rs
- Chạy file `rustup-init.exe`, chọn option 1 (default)
- Kiểm tra: `rustc --version`

### Bước 3 — Cài VS Build Tools (bắt buộc cho Tauri trên Windows)
- Tải tại: https://visualstudio.microsoft.com/visual-cpp-build-tools
- Cài **"Desktop development with C++"** workload
- Dung lượng khoảng 5–8GB, cài xong restart máy

### Bước 4 — Cài WebView2 (thường đã có sẵn trên Windows 11)
- Kiểm tra: vào Settings → Apps → tìm "WebView2"
- Nếu chưa có: https://developer.microsoft.com/microsoft-edge/webview2

### Bước 5 — Cài Tauri CLI
```bash
npm install -g @tauri-apps/cli
```

### Bước 6 — Kiểm tra toàn bộ môi trường
```bash
npm create tauri-app@latest -- --help
```
Nếu không báo lỗi là môi trường đã sẵn sàng.

---

## 2. Tổng quan dự án

**Tên app:** DayTask
**Nền tảng:** Windows 11 desktop app (`.exe` / `.msi`)
**Dung lượng dự kiến:** 5–10MB
**Ngôn ngữ:**
- Frontend (UI): React + TypeScript + CSS
- Backend (logic, file, notification): Rust (Tauri)
- Database: SQLite qua thư viện `tauri-plugin-sql`

---

## 3. Tính năng

### Tab 1 — Hôm nay (Daily tasks)
- Thêm / sửa / xóa task
- Đánh dấu hoàn thành (checkbox)
- Phân loại: Công việc, Cá nhân, Sức khỏe, Học tập
- Mỗi task có: tên, mô tả, giờ nhắc, danh mục, mức ưu tiên (cao/trung/thấp)
- Section "Chưa hoàn thành" và "Đã hoàn thành"
- Thanh tiến độ ngày (vd: 3/5 task → 60%)
- Stat cards: số task hoàn thành, streak, số nhắc nhở còn lại

### Tab 2 — Kế hoạch năm (Kanban)
- Board 4 cột: Chưa bắt đầu / Đang thực hiện / Đang review / Hoàn thành
- Kéo thả (drag & drop) task giữa các cột — dùng `@dnd-kit/core`
- Mỗi goal card có: tên, mô tả, danh mục, deadline theo quý, ưu tiên, thanh tiến độ %
- Chuyển năm qua lại (← 2026 →)
- Thanh tiến độ tổng năm

### Tab 3 — Heatmap
- Calendar grid kiểu GitHub (13 tuần × 7 ngày)
- Màu sắc theo số task hoàn thành trong ngày
- Xem 3 tháng gần nhất hoặc cả năm
- Hiển thị streak

### Nhắc nhở
- Background timer kiểm tra mỗi phút
- Windows native notification đúng giờ
- Nút "Bỏ qua" và "Dời 10 phút"
- App thu nhỏ xuống system tray thay vì đóng hẳn

### Auto-update
- Kiểm tra GitHub Releases khi khởi động
- Thông báo nếu có version mới
- Dùng `tauri-plugin-updater` (có sẵn trong Tauri v2)

---

## 4. Giao diện

### Màu sắc
- **Primary:** `#185FA5`
- **Font:** Segoe UI (Windows native)
- Light mode + Dark mode toggle

### Màu danh mục
| Danh mục | Nền | Chữ |
|---|---|---|
| Công việc | #E6F1FB | #0C447C |
| Cá nhân | #E1F5EE | #085041 |
| Sức khỏe | #FAEEDA | #633806 |
| Học tập | #EEEDFE | #3C3489 |

### Màu cột Kanban
| Cột | Header bg | Badge bg |
|---|---|---|
| Chưa bắt đầu | #F1EFE8 | #D3D1C7 |
| Đang thực hiện | #E6F1FB | #B5D4F4 |
| Đang review | #FAEEDA | #FAC775 |
| Hoàn thành | #EAF3DE | #C0DD97 |

### Màu heatmap
| Mức | Màu |
|---|---|
| 0 task | #F1EFE8 (xám nhạt) |
| 1–2 task | #B5D4F4 (xanh nhạt) |
| 3–4 task | #378ADD (xanh vừa) |
| 5+ task | #0C447C (xanh đậm) |

---

## 5. Cấu trúc thư mục

```
daytask/
├── src-tauri/                  # Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs             # Entry point
│       ├── db.rs               # SQLite setup & queries
│       ├── reminder.rs         # Background timer & notifications
│       └── tray.rs             # System tray
├── src/                        # React frontend
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── today/
│   │   │   ├── TodayView.tsx
│   │   │   ├── TaskCard.tsx
│   │   │   └── AddTaskModal.tsx
│   │   ├── kanban/
│   │   │   ├── KanbanView.tsx
│   │   │   ├── KanbanColumn.tsx
│   │   │   └── GoalCard.tsx
│   │   └── heatmap/
│   │       ├── HeatmapView.tsx
│   │       └── HeatmapGrid.tsx
│   ├── hooks/
│   │   ├── useTasks.ts
│   │   └── useGoals.ts
│   ├── store/
│   │   └── appStore.ts         # Zustand global state
│   └── types/
│       └── index.ts            # TypeScript interfaces
├── package.json
└── README.md
```

---

## 6. Database schema (SQLite)

```sql
-- Task hàng ngày
CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT,
    category    TEXT CHECK(category IN ('work','personal','health','learn')),
    priority    TEXT CHECK(priority IN ('high','mid','low')) DEFAULT 'mid',
    reminder    TEXT,               -- 'HH:MM' hoặc NULL
    date        TEXT NOT NULL,      -- 'YYYY-MM-DD'
    is_done     INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
);

-- Mục tiêu năm
CREATE TABLE IF NOT EXISTS goals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT,
    category    TEXT CHECK(category IN ('work','personal','health','learn')),
    priority    TEXT CHECK(priority IN ('high','mid','low')) DEFAULT 'mid',
    year        INTEGER NOT NULL,
    quarter     TEXT CHECK(quarter IN ('Q1','Q2','Q3','Q4','full')),
    status      TEXT CHECK(status IN ('todo','doing','review','done')) DEFAULT 'todo',
    progress    INTEGER DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
    position    INTEGER DEFAULT 0,  -- thứ tự trong cột kanban
    created_at  TEXT DEFAULT (datetime('now'))
);
```

---

## 7. Dependencies chính

### package.json (frontend)
```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-sql": "^2",
    "@tauri-apps/plugin-notification": "^2",
    "@tauri-apps/plugin-updater": "^2",
    "@dnd-kit/core": "^6",
    "@dnd-kit/sortable": "^8",
    "zustand": "^4",
    "date-fns": "^3"
  },
  "devDependencies": {
    "typescript": "^5",
    "vite": "^5",
    "@tauri-apps/cli": "^2"
  }
}
```

### Cargo.toml (Rust backend)
```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon", "system-tray"] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
tauri-plugin-notification = "2"
tauri-plugin-updater = "2"
serde = { version = "1", features = ["derive"] }
tokio = { version = "1", features = ["full"] }
```

---

## 8. Tauri commands (Rust → React bridge)

```rust
// Các lệnh React gọi sang Rust
#[tauri::command] get_tasks(date: String) -> Vec<Task>
#[tauri::command] add_task(task: NewTask) -> Task
#[tauri::command] update_task(id: i64, updates: TaskUpdate) -> Task
#[tauri::command] delete_task(id: i64) -> bool
#[tauri::command] toggle_task(id: i64) -> Task

#[tauri::command] get_goals(year: i32) -> Vec<Goal>
#[tauri::command] add_goal(goal: NewGoal) -> Goal
#[tauri::command] update_goal(id: i64, updates: GoalUpdate) -> Goal
#[tauri::command] move_goal(id: i64, status: String, position: i32) -> Goal
#[tauri::command] delete_goal(id: i64) -> bool

#[tauri::command] get_heatmap(year: i32) -> Vec<DayActivity>
#[tauri::command] get_streak() -> i32
```

---

## 9. Build & release

### Dev (chạy thử)
```bash
npm run tauri dev
```

### Build .exe cho Windows
```bash
npm run tauri build
# Output: src-tauri/target/release/bundle/
#   └── msi/DayTask_x.x.x_x64_en-US.msi   ← installer
#   └── nsis/DayTask_x.x.x_x64-setup.exe  ← installer nhỏ hơn
```

### Release lên GitHub (để auto-update hoạt động)
1. Build xong → tạo GitHub Release với tag `v1.0.0`
2. Upload file `.msi` và `.exe` lên Release
3. Tauri updater tự check và thông báo cho user

---

## 10. Thứ tự build cho Claude Code

```
Bước 1  — Khởi tạo project Tauri + React + TypeScript
Bước 2  — Setup SQLite, tạo schema, viết Tauri commands CRUD
Bước 3  — Layout chính: App.tsx, Sidebar, routing giữa 3 tab
Bước 4  — TodayView: danh sách task, thêm/sửa/xóa, checkbox
Bước 5  — AddTaskModal: form nhập task với danh mục, giờ nhắc, ưu tiên
Bước 6  — KanbanView: 4 cột, GoalCard, drag & drop bằng @dnd-kit
Bước 7  — HeatmapView: calendar grid, tô màu theo activity
Bước 8  — Reminder service: background timer, Windows notification, system tray
Bước 9  — Light/Dark mode toggle
Bước 10 — Auto-update qua tauri-plugin-updater
Bước 11 — Build .msi / .exe và test
```

---

## 11. Prompt để bắt đầu với Claude Code

```
Đọc file DAYTASK_PROJECT_BRIEF_v2.md và bắt đầu xây dựng app DayTask.
Tech stack: Tauri v2 + React + TypeScript + SQLite.
Bắt đầu từ Bước 1: khởi tạo project bằng lệnh:
  npm create tauri-app@latest daytask -- --template react-ts
Sau đó setup đúng cấu trúc thư mục và dependencies theo spec.
Làm lần lượt từng bước, hỏi tôi nếu cần làm rõ.
```
