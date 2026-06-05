# Journal Tab — Design Spec & Implementation Guide

> Paste file này vào Claude Code và nói:
> **"Đọc file JOURNAL_TAB_SPEC.md và implement tab Journal vào app DayTask theo đúng spec."**

---

## 1. Tổng quan

Thêm tab **Journal** vào topbar của app, nằm giữa tab Calendar và Heatmap.

Tab Journal có 2 chức năng chính:
- **Biết ơn hàng ngày** — ghi những điều trân trọng trong ngày
- **Bài học tâm đắc** — ghi những điều ngộ ra, học được

---

## 2. Layout tổng thể

```
┌─────────────────────────────────────────────────────┐
│ TOPBAR: [Atomic logo] [Today][Calendar][Year Plan]  │
│         [Journal ← active][Heatmap]    [Settings]   │
├──────────────┬──────────────────────────────────────┤
│              │  JOURNAL HEAD                        │
│   SIDEBAR    │  Date + 2-tab toggle                 │
│   (200px)    ├──────────────────────────────────────┤
│              │  CONTENT AREA (scroll)               │
│  Mini cal    │  - Prompt banner (ẩn sau khi viết)   │
│  Streak      │  - Write card (hôm nay)              │
│  Stats       │  - Divider "Trước đó"                │
│              │  - Entry cards cũ (scroll)           │
└──────────────┴──────────────────────────────────────┘
```

---

## 3. Màu sắc — Hệ thống 2 tông cam

Toàn bộ Journal dùng màu cam chủ đạo của app `#DA7756`,
phân biệt 2 loại bằng độ đậm nhạt:

### Tab Biết ơn — Cam đậm `#DA7756`
```
accent color:     #DA7756
bg prompt:        #211509
border prompt:    #3D2410
bg write card:    #1e1e1e
border write:     #2e2210
active toggle bg: #2A1A0A
active toggle fg: #DA7756
save button:      #DA7756 (text: #fff)
item numbers:     #DA7756
icon:             ti-heart (outline)
```

### Tab Bài học — Cam vàng nhạt `#EF9F27`
```
accent color:     #EF9F27
bg prompt:        #1C1508
border prompt:    #382C0A
bg write card:    #1e1e1e
border write:     #2a2208
active toggle bg: #1E1408
active toggle fg: #EF9F27
save button:      #EF9F27 (text: #1a1a1a)
item numbers:     #EF9F27
icon:             ti-bulb (outline)
```

### Màu chung
```
app background:   #1a1a1a
sidebar bg:       #161616
card bg:          #1e1e1e
border default:   #2a2a2a
border subtle:    #222222
text primary:     #e0e0e0
text secondary:   #ccc
text muted:       #555
text disabled:    #444
```

---

## 4. Component: Sidebar (200px)

### 4.1 Mini Calendar
- Hiển thị tháng hiện tại dạng grid 7 cột
- Ngày có entry: chữ màu `#DA7756`
- Ngày hôm nay: background `#DA7756`, chữ trắng
- Ngày thường: chữ `#555`
- Bấm vào ngày → scroll tới entry của ngày đó

### 4.2 Streak Counter
```
┌─────────────────┐
│ 🔥 4            │
│ ngày liên tiếp  │
└─────────────────┘
background: #1e1e1e
border: 0.5px solid #2a2a2a
border-radius: 8px
streak number color: #DA7756
```
Logic: đếm số ngày liên tiếp (bất kỳ tab nào) tính đến hôm nay

### 4.3 Stats tháng
```
❤ Biết ơn    4 ngày   (màu #DA7756)
💡 Bài học   3 ngày   (màu #EF9F27)
```
Icon: `ti-heart` cho biết ơn, `ti-bulb` cho bài học

---

## 5. Component: Journal Head

```
[Thứ Sáu, 5 tháng 6]          [❤ Biết ơn | 💡 Bài học]
[Hôm nay · chưa có entry]
```

### Toggle 2 tab
```css
.type-toggle {
  background: #222;
  border-radius: 8px;
  padding: 3px;
}

.tt-btn {
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
}

/* Biết ơn active */
.active-gratitude {
  background: #2A1A0A;
  color: #DA7756;
  font-weight: 500;
}

/* Bài học active */
.active-lesson {
  background: #1E1408;
  color: #EF9F27;
  font-weight: 500;
}
```

---

## 6. Component: Prompt Banner

Hiện khi mở trang, ẩn sau khi user bắt đầu gõ (hoặc bấm ✕).

### Biết ơn
```
icon:       ti-heart  màu #DA7756
background: #211509
border:     0.5px solid #3D2410
text color: #DA7756
text:       "Hôm nay điều gì khiến bạn cảm thấy biết ơn?
             Có thể là một người, một khoảnh khắc nhỏ,
             hay điều gì đó bạn thường bỏ qua."
```

### Bài học
```
icon:       ti-bulb  màu #EF9F27
background: #1C1508
border:     0.5px solid #382C0A
text color: #EF9F27
text:       "Hôm nay bạn học được điều gì?
             Có thể từ sách, từ một sai lầm,
             từ cuộc trò chuyện hay từ chính bản thân mình."
```

### Logic ẩn/hiện
```javascript
// Ẩn prompt khi user bắt đầu gõ
textarea.addEventListener('input', () => {
  if (textarea.value.length > 0) {
    promptBanner.style.display = 'none'
  }
})
// Hoặc bấm nút ✕ (ti-x icon) để đóng thủ công
```

---

## 7. Component: Write Card (nhập entry hôm nay)

### Structure
```
┌─ Write card ──────────────────────────────────┐
│ ✏ Ghi hôm nay                    5/6/2026    │
├───────────────────────────────────────────────┤
│ 1  [textarea placeholder]                     │
├───────────────────────────────────────────────┤
│ 2  [textarea placeholder]                     │
├───────────────────────────────────────────────┤
│ 3  [textarea placeholder]                     │
├───────────────────────────────────────────────┤
│ + Thêm ý                                      │
├───────────────────────────────────────────────┤
│ 0 ký tự                        [Lưu hôm nay] │
└───────────────────────────────────────────────┘
```

### Mặc định số ô
- Tab Biết ơn: 3 ô (placeholder: "Tôi biết ơn vì...")
- Tab Bài học: 1 ô (placeholder: "Bài học tôi ngộ ra hôm nay là...")

### Tính năng linh hoạt
- Bấm "+ Thêm ý" → append thêm 1 textarea, focus vào đó
- Số thứ tự tự tăng (1, 2, 3, ...)
- Mỗi textarea tự resize theo nội dung:
```javascript
textarea.addEventListener('input', function() {
  this.style.height = 'auto'
  this.style.height = this.scrollHeight + 'px'
})
```
- Có thể xóa từng ô (icon `ti-x` nhỏ hiện khi hover)
- Char count tổng cộng tất cả ô trong ngày

### Database schema — entries
```sql
CREATE TABLE IF NOT EXISTS journal_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,        -- 'YYYY-MM-DD'
  type        TEXT NOT NULL,        -- 'gratitude' | 'lesson'
  items       TEXT NOT NULL,        -- JSON array of strings
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);
-- index để query nhanh theo ngày
CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(date, type);
```

### Tauri commands cần thêm
```rust
#[tauri::command] get_journal(date: String, journal_type: String) -> Option<JournalEntry>
#[tauri::command] save_journal(date: String, journal_type: String, items: Vec<String>) -> JournalEntry
#[tauri::command] delete_journal(id: i64) -> bool
#[tauri::command] get_journal_history(journal_type: String, limit: i32) -> Vec<JournalEntry>
#[tauri::command] get_journal_streak() -> i32
#[tauri::command] get_journal_stats(year: i32, month: i32) -> JournalStats
```

---

## 8. Component: Entry Cards (lịch sử)

Hiển thị sau divider "Trước đó", scroll liên tục từ mới → cũ.

```
┌─ Entry card ──────────────────────────────────┐
│ Thứ Năm, 4 tháng 6          [✏ edit] [🗑]    │
├───────────────────────────────────────────────┤
│ 1  Nội dung entry...                          │
├───────────────────────────────────────────────┤
│ 2  Nội dung entry...                          │
└───────────────────────────────────────────────┘
```

- Border màu theo tab: Biết ơn `#2e2210`, Bài học `#2a2208`
- Số thứ tự màu theo tab: `#DA7756` hoặc `#EF9F27`
- Bấm ✏ → inline edit (chuyển sang textarea)
- Bấm 🗑 → confirm rồi xóa
- Load 10 entry đầu, infinite scroll để load thêm

---

## 9. Divider "Trước đó"

```html
<div style="display:flex;align-items:center;gap:8px;">
  <div style="flex:1;height:0.5px;background:#222;"></div>
  <span style="font-size:10px;color:#444;text-transform:uppercase;
               letter-spacing:0.5px;">Trước đó</span>
  <div style="flex:1;height:0.5px;background:#222;"></div>
</div>
```

---

## 10. Logic lưu/đọc dữ liệu

```typescript
// Khi mở tab Journal
const today = new Date().toISOString().split('T')[0] // 'YYYY-MM-DD'

// Load entry hôm nay (nếu có)
const todayEntry = await invoke('get_journal', {
  date: today,
  journalType: activeTab // 'gratitude' | 'lesson'
})

if (todayEntry) {
  // Fill vào các textarea
  populateWriteCard(todayEntry.items)
  // Ẩn prompt banner
  hidepromptBanner()
} else {
  // Hiện prompt banner
  showPromptBanner()
}

// Load lịch sử
const history = await invoke('get_journal_history', {
  journalType: activeTab,
  limit: 10
})
```

---

## 11. Thứ tự implement cho Claude Code

```
Bước 1  — Thêm tab "Journal" vào topbar, giữa Calendar và Heatmap
           Icon: ti-notebook
Bước 2  — Tạo JournalView component với layout 2 cột (sidebar + main)
Bước 3  — Implement Sidebar: mini calendar, streak, stats tháng
Bước 4  — Implement Journal Head: date display + 2-tab toggle
Bước 5  — Implement Prompt Banner với logic ẩn/hiện
Bước 6  — Implement Write Card: textarea linh hoạt, thêm/xóa ô, auto-resize
Bước 7  — Implement lưu entry vào SQLite qua Tauri command
Bước 8  — Implement Entry Cards: hiển thị lịch sử, edit inline, xóa
Bước 9  — Implement streak counter và stats tháng
Bước 10 — Kết nối mini calendar: ngày có entry highlight màu #DA7756
```

---

## 12. Prompt để bắt đầu với Claude Code

```
Đọc file JOURNAL_TAB_SPEC.md và implement tab Journal vào app Atomic.
Làm từng bước theo thứ tự ở Phần 11.
Bắt đầu từ Bước 1: thêm tab Journal vào topbar.
Hỏi tôi nếu cần làm rõ bất kỳ phần nào.
```
