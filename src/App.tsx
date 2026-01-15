/**
 * Connexio - Main Application Component
 *
 * Modern Windows Terminal with Session Persistence
 *
 * Features:
 * - Multi-tab terminal support (Epic 3)
 * - Session persistence (Epic 4)
 * - Theme system (Epic 5)
 * - CLI argument support (Epic 6)
 * - Session-based workspaces (v1.2) - terminals persist when switching!
 */

import { useEffect, useCallback, useState, useRef } from "react";
import { MainLayout, TabBar } from "@/components/layout";
import { TerminalViewport } from "@/components/terminal";
import {
  TerminalErrorBoundary,
  SettingsDialog,
  AboutDialog,
  UpdateDialog,
  useAutoUpdateCheck,
} from "@/components/ui";
import {
  useSessionStore,
  useTabs,
  useActiveTabId,
  useAllTabs,
  useActiveWorkspaceId,
  useSessionHydrated,
  initializeTheme,
  useDefaultShell,
} from "@/stores";
import { killPty, getStartupConfig, clearStartupConfig, isTauri } from "@/lib/tauri";
import type { ShellType } from "@/types/terminal.types";
import "@/styles/globals.css";

// Initialize theme CSS variables before first render to prevent flash
initializeTheme();

function App() {
  const tabs = useTabs();
  const activeTabId = useActiveTabId();
  const allTabs = useAllTabs();
  const activeWorkspaceId = useActiveWorkspaceId();
  const defaultShell = useDefaultShell();
  const isHydrated = useSessionHydrated();
  const { addTab, updateTab, nextTab, prevTab, goToTab, removeTab } = useSessionStore();

  // Settings dialog state
  const [settingsOpen, setSettingsOpen] = useState(false);

  // About dialog state
  const [aboutOpen, setAboutOpen] = useState(false);

  // Update dialog state
  const [updateOpen, setUpdateOpen] = useState(false);

  // Auto-check for updates on startup
  const { updateAvailable } = useAutoUpdateCheck();

  // Show update dialog when update is available
  useEffect(() => {
    if (updateAvailable) {
      setUpdateOpen(true);
    }
  }, [updateAvailable]);

  // Track if we've processed startup config
  const startupProcessedRef = useRef(false);

  // Handle CLI startup configuration (Story 6.2, 6.3)
  useEffect(() => {
    if (startupProcessedRef.current) return;

    const processStartupConfig = async () => {
      if (!isTauri()) return;

      try {
        const config = await getStartupConfig();

        if (config && config.skip_session_restore) {
          startupProcessedRef.current = true;

          // Clear existing tabs from current workspace
          const state = useSessionStore.getState();
          const currentWs = state.getActiveWorkspace();
          for (const tab of currentWs.tabs) {
            if (tab.ptyId) {
              await killPty(tab.ptyId).catch(console.error);
            }
            removeTab(tab.id);
          }

          // Add new tab with CLI-specified directory
          const workingDir = config.working_directory || undefined;
          addTab(defaultShell, workingDir);

          // Clear the startup config so it's not reused
          await clearStartupConfig();

          console.log("[App] Started with CLI args:", config);
        }
      } catch (e) {
        console.error("[App] Failed to process startup config:", e);
      }
    };

    processStartupConfig();
  }, [addTab, defaultShell, removeTab]);

  // Create first tab on mount if no tabs exist (and no CLI args)
  // IMPORTANT: Wait for hydration to complete before checking tabs.length
  // to prevent race condition where a new tab is created before persisted tabs are loaded
  useEffect(() => {
    if (!isHydrated) return; // Wait for hydration
    if (tabs.length === 0 && !startupProcessedRef.current) {
      addTab(defaultShell);
    }
  }, [isHydrated, tabs.length, addTab, defaultShell]);

  // Handle keyboard shortcuts for tab navigation and settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+,: Open settings
      if (e.ctrlKey && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      }
      // Ctrl+T: New tab
      else if (e.ctrlKey && e.key === "t") {
        e.preventDefault();
        addTab(defaultShell);
      }
      // Ctrl+W: Close current tab
      else if (e.ctrlKey && e.key === "w") {
        e.preventDefault();
        if (activeTabId) {
          const tab = tabs.find((t) => t.id === activeTabId);
          if (tab?.ptyId) {
            killPty(tab.ptyId).catch(console.error);
          }
          removeTab(activeTabId);
        }
      }
      // Ctrl+Tab: Next tab
      else if (e.ctrlKey && e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        nextTab();
      }
      // Ctrl+Shift+Tab: Previous tab
      else if (e.ctrlKey && e.shiftKey && e.key === "Tab") {
        e.preventDefault();
        prevTab();
      }
      // Ctrl+1-9: Go to tab by index
      else if (e.ctrlKey && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        goToTab(parseInt(e.key, 10));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTabId, tabs, addTab, defaultShell, nextTab, prevTab, goToTab, removeTab]);

  // Handle terminal ready - link PTY ID to tab
  const handleTerminalReady = useCallback(
    (tabId: string) => (ptyId: string) => {
      updateTab(tabId, { ptyId, isLoading: false });
    },
    [updateTab]
  );

  // Handle terminal exit
  const handleTerminalExit = useCallback(
    (tabId: string) => (exitCode: number | null) => {
      updateTab(tabId, { hasExited: true, exitCode });
    },
    [updateTab]
  );

  // Handle title change from shell (OSC sequences)
  // IMPORTANT: Don't overwrite user-renamed tabs (titleLocked)
  const handleTitleChange = useCallback(
    (tabId: string) => (newTitle: string) => {
      const state = useSessionStore.getState();
      const tab = state.getTab(tabId);
      if (!tab) return;

      // If title is locked (user renamed), don't accept shell title changes
      if (tab.titleLocked) {
        return;
      }

      updateTab(tabId, { title: newTitle });
    },
    [updateTab]
  );

  // Handle CWD change (from OSC 7 sequences or prompt parsing)
  const handleCwdChange = useCallback(
    (tabId: string) => (cwd: string) => {
      updateTab(tabId, { workingDirectory: cwd });
    },
    [updateTab]
  );

  // Handle new tab from TabBar
  const handleNewTab = useCallback((shellType: ShellType) => {
    // Tab is already added by TabBar, no additional action needed
    console.log("New tab requested:", shellType);
  }, []);

  // Handle close tab - kill PTY before removing
  const handleCloseTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (tab?.ptyId) {
        killPty(tab.ptyId).catch(console.error);
      }
    },
    [tabs]
  );

  // Get active tab for title
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const title = activeTab?.title || "Connexio";

  return (
    <MainLayout
      title={title}
      onSettingsClick={() => setSettingsOpen(true)}
      onAboutClick={() => setAboutOpen(true)}
    >
      <div className="h-full w-full flex flex-col bg-background">
        {/* Tab Bar */}
        <TabBar onNewTab={handleNewTab} onCloseTab={handleCloseTab} />

        {/* Terminal viewport(s) - render ALL tabs from ALL workspaces for persistence */}
        <div className="flex-1 relative overflow-hidden">
          {allTabs.map(({ workspaceId, tab }) => {
            // Tab is visible if it's in the active workspace AND is the active tab
            const isInActiveWorkspace = workspaceId === activeWorkspaceId;
            const isActiveTab = tab.id === activeTabId;
            const isVisible = isInActiveWorkspace && isActiveTab;

            return (
              <div
                key={tab.id}
                className={`absolute inset-0 ${isVisible ? "visible" : "invisible"}`}
                style={{ pointerEvents: isVisible ? "auto" : "none" }}
              >
                <TerminalErrorBoundary
                  onError={(error) => {
                    console.error(`Terminal ${tab.id} crashed:`, error);
                    updateTab(tab.id, { hasExited: true, exitCode: -1 });
                  }}
                >
                  <TerminalViewport
                    shellType={tab.shellType}
                    workingDirectory={tab.workingDirectory ?? undefined}
                    onReady={handleTerminalReady(tab.id)}
                    onExit={handleTerminalExit(tab.id)}
                    onTitleChange={handleTitleChange(tab.id)}
                    onCwdChange={handleCwdChange(tab.id)}
                    isActive={isVisible}
                  />
                </TerminalErrorBoundary>
              </div>
            );
          })}

          {/* Empty state */}
          {tabs.length === 0 && (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <p>Press Ctrl+T to open a new tab</p>
            </div>
          )}
        </div>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onCheckUpdates={() => {
          setSettingsOpen(false);
          setUpdateOpen(true);
        }}
      />

      {/* About Dialog */}
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />

      {/* Update Dialog */}
      <UpdateDialog open={updateOpen} onOpenChange={setUpdateOpen} checkOnMount />
    </MainLayout>
  );
}

export default App;
