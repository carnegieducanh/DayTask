import React from "react";
import ReactDOM from "react-dom/client";
// Lora nhúng sẵn trong bản build (trước tải từ Google Fonts nên mất khi offline).
// Chỉ có 400 thường + nghiêng: Lora không có bản 300, chỗ nào ghi font-weight: 300 vẫn ra 400 như trước.
import "@fontsource/lora/400.css";
import "@fontsource/lora/400-italic.css";
// 600/700 chỉ cho chữ số trong badge: 600 = số việc chờ trên navbar, 700 = nhãn giờ hiện tại
// ở Day view — chỉ bộ latin; chữ tiếng Việt Lora đậm (nếu sau này có) sẽ cần thêm vietnamese-*.
import "@fontsource/lora/latin-600.css";
import "@fontsource/lora/latin-700.css";
import App from "./App";
import TrayPopup from "./components/TrayPopup";
import TrayContextMenu from "./components/TrayContextMenu";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const windowLabel = (window as any).__TAURI_INTERNALS__?.metadata?.currentWindow?.label as string | undefined;

function Root() {
  if (windowLabel === "tray-popup") return <TrayPopup />;
  if (windowLabel === "tray-context") return <TrayContextMenu />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
