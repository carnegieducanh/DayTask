# Lenis Smooth Scroll

## 1. Mô tả

Thêm smooth scroll cho toàn bộ trang web bằng thư viện **Lenis**. Thay thế scroll mặc định của browser bằng một animation mượt mà hơn, có thể tùy chỉnh tốc độ và easing.

Có **2 cách tích hợp** tùy theo page có dùng GSAP ScrollTrigger hay không:

- **Với GSAP ScrollTrigger** (trang chính): dùng `gsap.ticker` để drive Lenis, đồng thời hook `lenis.on("scroll", ScrollTrigger.update)` để ScrollTrigger sync đúng với scroll position.
- **Không dùng GSAP** (page phụ như AllProjects): dùng `requestAnimationFrame` loop đơn giản.

---

## 2. Dependencies

```bash
npm install lenis
# hoặc
npm install @studio-freight/lenis  # tên cũ, một số project vẫn dùng
```

Nếu kết hợp với GSAP ScrollTrigger:

```bash
npm install gsap
```

---

## 3. Cấu trúc file

Không cần tạo file riêng. Tích hợp trực tiếp vào:

```
src/
  App.jsx          ← Lenis cho trang chính (có GSAP)
  pages/
    AllProjects.jsx ← Lenis cho page phụ (RAF thuần)
```

---

## 4. Code mẫu

### 4a. Page có GSAP ScrollTrigger (App.jsx / layout chính)

```jsx
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

function PortfolioPage() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.4,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.9,
    });

    // Bắt buộc: sync Lenis với ScrollTrigger
    lenis.on("scroll", ScrollTrigger.update);

    // GSAP ticker drive Lenis (thay vì RAF loop riêng)
    const tickerFn = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(tickerFn);
    gsap.ticker.lagSmoothing(0);

    // Expose để các component khác có thể gọi lenis.scrollTo(...)
    window.__lenis = lenis;

    return () => {
      lenis.destroy();
      gsap.ticker.remove(tickerFn);
      window.__lenis = null;
    };
  }, []);
}
```

> **Lưu ý:** `gsap.ticker` truyền `time` theo đơn vị giây → phải nhân `* 1000` cho `lenis.raf()`.

### 4b. Page phụ không dùng GSAP (ví dụ AllProjects.jsx)

```jsx
import Lenis from "lenis";

export default function AllProjects() {
  useEffect(() => {
    window.scrollTo(0, 0); // reset position trước khi Lenis khởi động

    const lenis = new Lenis({
      duration: 1.4,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.9,
    });

    let rafId;
    function raf(time) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);
}
```

### 4c. Scroll đến section bằng Lenis (từ Navbar, button...)

```jsx
// Scroll mượt đến element
const lenis = window.__lenis;
if (lenis) {
  lenis.scrollTo("#about", { offset: -80, duration: 1.2 });
} else {
  document.querySelector("#about")?.scrollIntoView({ behavior: "smooth" });
}

// Scroll về đầu trang ngay lập tức (không animation)
lenis ? lenis.scrollTo(0, { immediate: true }) : window.scrollTo({ top: 0 });
```

---

## 5. Các tham số cấu hình

| Tham số         | Giá trị dùng | Ý nghĩa                                         |
| --------------- | ------------ | ----------------------------------------------- |
| `duration`      | `1.4`        | Thời gian scroll (giây). Cao hơn = mượt hơn/chậm hơn |
| `easing`        | exponential  | Curve deceleration — nhanh đầu, chậm cuối       |
| `smoothWheel`   | `true`       | Bật smooth cho mouse wheel                      |
| `wheelMultiplier` | `0.9`      | Tốc độ scroll. `< 1` = chậm hơn default        |

---

## 6. Lưu ý khi adapt sang dự án khác

### Không được tạo 2 instance Lenis cùng lúc trên cùng một trang
Nếu dùng React Router, mỗi Route component chỉ nên khởi tạo 1 Lenis. Cleanup trong `return` của `useEffect` là bắt buộc.

### Lenis v1.x vs v2.x
- v1: import `from "lenis"` hoặc `from "@studio-freight/lenis"`
- v2: API tương tự nhưng có thêm `Lenis({ wrapper, content })` cho scroll trong container (không phải window)
- Kiểm tra version bằng `npm list lenis`

### Khi dùng với ScrollTrigger
- **Bắt buộc** phải có `lenis.on("scroll", ScrollTrigger.update)` — nếu thiếu, GSAP animation sẽ bị lệch với scroll position thực.
- **Không** dùng `scrollerProxy` với Lenis v1 — Lenis scroll native window nên không cần proxy.

### Khi dùng `lenis.scrollTo()` với `immediate: true`
- `immediate: true` bỏ qua animation, nhảy thẳng đến vị trí
- Nếu target là element bên trong GSAP pin section (sticky scroll), cần tính `offsetTop` thủ công thay vì truyền element/selector trực tiếp

### Mobile
- Lenis hoạt động tốt trên desktop. Trên mobile, smooth scroll đôi khi conflict với native momentum scroll của iOS — test kỹ trên Safari/iOS trước khi deploy.
- Có thể disable trên mobile: `new Lenis({ smoothTouch: false })` (default đã là `false`)

### CSS scroll-behavior
Nếu project có `html { scroll-behavior: smooth }` trong CSS, hãy **bỏ đi** — sẽ conflict với Lenis và tạo double-smooth effect.
