import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

// Check if this is a public route BEFORE importing heavy modules
const isPublicRoute = (path: string) =>
  path.startsWith("/view/") ||
  path.startsWith("/approve/") ||
  path.startsWith("/contract/") ||
  path.startsWith("/analytics/") ||
  path.startsWith("/public/calendar/");

const currentPath = window.location.pathname;

// Conditionally import the appropriate app shell
const handleImportError = (err: unknown) => {
  console.error("Failed to load module, reloading page:", err);
  // Avoid infinite reload loops
  const lastReload = sessionStorage.getItem("last_chunk_reload");
  const now = Date.now();
  if (!lastReload || now - Number(lastReload) > 10000) {
    sessionStorage.setItem("last_chunk_reload", String(now));
    window.location.reload();
  }
};

if (isPublicRoute(currentPath)) {
  import("./components/layout/PublicApp")
    .then(({ PublicApp }) => {
      createRoot(document.getElementById("root")!).render(
        <React.StrictMode>
          <PublicApp />
        </React.StrictMode>
      );
    })
    .catch(handleImportError);
} else {
  import("./lib/publicConfig")
    .then(({ initPublicConfig }) => initPublicConfig())
    .catch(handleImportError);

  import("./App")
    .then(({ default: App }) => {
      createRoot(document.getElementById("root")!).render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    })
    .catch(handleImportError);
}
