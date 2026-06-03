import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import TrayPopup from "./components/TrayPopup";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const windowLabel = (window as any).__TAURI_INTERNALS__?.metadata?.currentWindow?.label as string | undefined;
const isTrayPopup = windowLabel === "tray-popup";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isTrayPopup ? <TrayPopup /> : <App />}
  </React.StrictMode>,
);
