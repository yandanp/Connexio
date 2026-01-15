import ReactDOM from "react-dom/client";
import App from "./App";

/**
 * Session Persistence Validation
 *
 * Validates stored session data before app loads.
 * Clears corrupted or invalid data to prevent issues.
 */
function validateSessionData(): void {
  const sessionKey = "connexio-session";
  const rawData = localStorage.getItem(sessionKey);

  if (!rawData) {
    console.log("[Connexio] No saved session found, starting fresh.");
    return;
  }

  try {
    const parsed = JSON.parse(rawData);
    const state = parsed?.state;

    // Validate structure
    if (!state || !Array.isArray(state.tabs)) {
      console.warn("[Connexio] Invalid session structure, clearing...");
      localStorage.removeItem(sessionKey);
      return;
    }

    // Validate tabs
    const validTabs = state.tabs.filter((tab: any) => {
      // Must have id and shellType
      if (!tab.id || !tab.shellType) return false;
      // shellType must be valid
      if (!["powershell", "cmd", "wsl", "gitbash"].includes(tab.shellType)) return false;
      return true;
    });

    // If some tabs were invalid, update the storage
    if (validTabs.length !== state.tabs.length) {
      console.warn(`[Connexio] Removed ${state.tabs.length - validTabs.length} invalid tabs`);
      state.tabs = validTabs;

      // If no valid tabs remain, clear entirely
      if (validTabs.length === 0) {
        localStorage.removeItem(sessionKey);
        console.log("[Connexio] No valid tabs, starting fresh.");
        return;
      }

      // Update with cleaned data
      localStorage.setItem(sessionKey, JSON.stringify(parsed));
    }

    console.log(`[Connexio] Restored session with ${validTabs.length} tab(s)`);
  } catch (e) {
    console.error("[Connexio] Failed to parse session data, clearing...", e);
    localStorage.removeItem(sessionKey);
  }
}

// Validate session before rendering
validateSessionData();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  // Note: StrictMode disabled to prevent double PTY spawn in development
  // This is a known issue with async effects that have cleanup
  // TODO: Re-enable when PTY lifecycle is more robust
  // <React.StrictMode>
  <App />
  // </React.StrictMode>
);
