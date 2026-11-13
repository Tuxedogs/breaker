import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
// Type roles (--mb-font-* in tokens.css): latin subsets, only the weights in use.
import "@fontsource/share-tech-mono/latin-400.css";
import "./index.css";

async function startApplication() {
  const fixturesEnabled = (import.meta.env.DEV && import.meta.env.VITE_FIXTURES_ENABLED)
    || (import.meta.env.MODE === 'fixtures' && import.meta.env.VITE_LOCAL_COMPILED_FIXTURE);
  // Compiled local fixtures never need a service worker (insecure LAN origins
  // cannot register one); the preview server blocks all backend routes instead.
  if (fixturesEnabled && import.meta.env.DEV) {
    const { worker } = await import("./dev/mocks/browser");
    await worker.start({
      onUnhandledRequest(request, print) {
        if (new URL(request.url).pathname.startsWith("/api/")) {
          print.error();
          throw new Error(`[fixtures] Unexpected application API request: ${request.method} ${request.url}`);
        }
      },
    });
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
        {fixturesEnabled ? (
          <div data-fixture-mode="active" style={{ position: "fixed", right: 8, bottom: 8, zIndex: 10000, padding: "4px 8px", background: "#7c3aed", color: "white", font: "600 12px 'Segoe UI', system-ui, sans-serif" }}>
            FIXTURE MODE — NETWORK DISABLED
          </div>
        ) : null}
      </BrowserRouter>
    </StrictMode>,
  );
}

void startApplication();
