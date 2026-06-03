import React from "react";
import ReactDOM from "react-dom/client";
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
