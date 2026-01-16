/**
 * Session Store - Session-based Workspace Management
 *
 * This store manages multiple workspace sessions where each workspace
 * has its own set of tabs with live PTY processes.
 *
 * Key features:
 * - Each workspace has its own tabs
 * - Switching workspaces doesn't kill PTY processes
 * - Terminals remain live in background when switching
 *
 * Epic 3: Tab Management + Epic 4: Session Persistence + v1.2: Session-based Workspaces
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { useMemo, useState, useEffect } from "react";
import type { ShellType } from "@/types/terminal.types";

/**
 * Tab state stored in session
 */
export interface TabState {
  /** Unique identifier for this tab */
  id: string;
  /** Shell type running in this tab */
  shellType: ShellType;
  /** Current working directory */
  workingDirectory: string | null;
  /** Tab title (from shell or user-set) */
  title: string;
  /** Whether the title is locked (user-renamed, don't accept shell title changes) */
  titleLocked?: boolean;
  /** PTY session ID (runtime only, not persisted) */
  ptyId?: string;
  /** Whether the tab is currently loading */
  isLoading?: boolean;
  /** Whether the shell process has exited */
  hasExited?: boolean;
  /** Exit code if process has exited */
  exitCode?: number | null;
}

/**
 * Available workspace colors
 */
export const WORKSPACE_COLORS = [
  { id: "blue", bg: "bg-blue-500", hex: "#3b82f6" },
  { id: "green", bg: "bg-green-500", hex: "#22c55e" },
  { id: "purple", bg: "bg-purple-500", hex: "#a855f7" },
  { id: "orange", bg: "bg-orange-500", hex: "#f97316" },
  { id: "pink", bg: "bg-pink-500", hex: "#ec4899" },
  { id: "cyan", bg: "bg-cyan-500", hex: "#06b6d4" },
  { id: "amber", bg: "bg-amber-500", hex: "#f59e0b" },
  { id: "red", bg: "bg-red-500", hex: "#ef4444" },
  { id: "indigo", bg: "bg-indigo-500", hex: "#6366f1" },
  { id: "teal", bg: "bg-teal-500", hex: "#14b8a6" },
] as const;

export type WorkspaceColorId = (typeof WORKSPACE_COLORS)[number]["id"];

/**
 * Workspace session - contains tabs for one workspace
 */
export interface WorkspaceSession {
  /** Unique workspace ID */
  id: string;
  /** User-defined workspace name */
  name: string;
  /** Custom color ID for the workspace icon */
  color?: WorkspaceColorId;
  /** Tabs in this workspace */
  tabs: TabState[];
  /** Active tab ID within this workspace */
  activeTabId: string | null;
  /** When workspace was created */
  createdAt: number;
  /** When workspace was last updated */
  updatedAt: number;
}

/**
 * Session state interface
 */
interface SessionState {
  /** All workspace sessions */
  workspaces: WorkspaceSession[];
  /** Currently active workspace ID (null = default session) */
  activeWorkspaceId: string | null;
  /** Default session for unsaved work */
  defaultSession: WorkspaceSession;
  /** Schema version for migrations */
  version: number;
}

/**
 * Session store actions
 */
interface SessionActions {
  // Workspace actions
  createWorkspace: (name: string, color?: WorkspaceColorId) => string;
  deleteWorkspace: (workspaceId: string) => void;
  renameWorkspace: (workspaceId: string, name: string) => void;
  setWorkspaceColor: (workspaceId: string, color: WorkspaceColorId) => void;
  switchWorkspace: (workspaceId: string | null) => void;
  duplicateWorkspace: (workspaceId: string) => string | null;

  // Tab actions (operate on active workspace)
  addTab: (shellType: ShellType, workingDirectory?: string) => string;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<TabState>) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;

  // Workspace reordering
  reorderWorkspaces: (fromIndex: number, toIndex: number) => void;

  // Getters
  getActiveWorkspace: () => WorkspaceSession;
  getActiveTab: () => TabState | undefined;
  getTab: (tabId: string) => TabState | undefined;
  getWorkspace: (workspaceId: string) => WorkspaceSession | undefined;

  // Tab navigation
  nextTab: () => void;
  prevTab: () => void;
  goToTab: (index: number) => void;
  closeTabsToRight: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  duplicateTab: (tabId: string) => string | null;
}

type SessionStore = SessionState & SessionActions;

/**
 * Hydration state tracking
 */
let hasHydrated = false;
const hydrationListeners = new Set<() => void>();

/**
 * Check if session store has been hydrated from storage
 */
export function isSessionHydrated(): boolean {
  return hasHydrated;
}

/**
 * Subscribe to hydration completion
 */
export function onSessionHydrated(callback: () => void): () => void {
  if (hasHydrated) {
    // Already hydrated, call immediately
    callback();
    return () => {};
  }
  hydrationListeners.add(callback);
  return () => {
    hydrationListeners.delete(callback);
  };
}

/**
 * Generate unique ID
 */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get default title for shell type
 */
export function getDefaultTitle(shellType: ShellType): string {
  const titles: Record<ShellType, string> = {
    powershell: "PowerShell",
    cmd: "Command Prompt",
    wsl: "WSL",
    gitbash: "Git Bash",
    csh: "Connexio Shell",
  };
  return titles[shellType];
}

/**
 * Create a new empty workspace session
 */
function createEmptySession(id: string, name: string): WorkspaceSession {
  return {
    id,
    name,
    tabs: [],
    activeTabId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Default session for unsaved work
 */
const DEFAULT_SESSION_ID = "__default__";

/**
 * Session store with persistence
 */
export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      // Initial state
      workspaces: [],
      activeWorkspaceId: null,
      defaultSession: createEmptySession(DEFAULT_SESSION_ID, "Default"),
      version: 2,

      // Workspace actions
      createWorkspace: (name, color) => {
        const id = generateId("ws");
        const now = Date.now();
        const initialTabId = generateId("tab");

        // Create workspace with one fresh PowerShell tab
        const newWorkspace: WorkspaceSession = {
          id,
          name: name.trim(),
          color,
          tabs: [
            {
              id: initialTabId,
              shellType: "powershell",
              workingDirectory: null,
              title: getDefaultTitle("powershell"),
              isLoading: true,
            },
          ],
          activeTabId: initialTabId,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          workspaces: [...state.workspaces, newWorkspace],
          activeWorkspaceId: id,
        }));

        return id;
      },

      deleteWorkspace: (workspaceId) => {
        set((state) => ({
          workspaces: state.workspaces.filter((ws) => ws.id !== workspaceId),
          activeWorkspaceId:
            state.activeWorkspaceId === workspaceId ? null : state.activeWorkspaceId,
        }));
      },

      renameWorkspace: (workspaceId, name) => {
        set((state) => ({
          workspaces: state.workspaces.map((ws) =>
            ws.id === workspaceId ? { ...ws, name: name.trim(), updatedAt: Date.now() } : ws
          ),
        }));
      },

      setWorkspaceColor: (workspaceId, color) => {
        set((state) => ({
          workspaces: state.workspaces.map((ws) =>
            ws.id === workspaceId ? { ...ws, color, updatedAt: Date.now() } : ws
          ),
        }));
      },

      switchWorkspace: (workspaceId) => {
        set({ activeWorkspaceId: workspaceId });
      },

      duplicateWorkspace: (workspaceId) => {
        const state = get();
        const workspace = state.workspaces.find((ws) => ws.id === workspaceId);
        if (!workspace) return null;

        const newId = generateId("ws");
        const now = Date.now();

        // Deep clone tabs with new IDs
        const newTabs = workspace.tabs.map((tab) => ({
          ...tab,
          id: generateId("tab"),
          ptyId: undefined,
          isLoading: true,
        }));

        const newWorkspace: WorkspaceSession = {
          ...workspace,
          id: newId,
          name: `${workspace.name} (Copy)`,
          tabs: newTabs,
          activeTabId: newTabs[0]?.id ?? null,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          workspaces: [...state.workspaces, newWorkspace],
        }));

        return newId;
      },

      // Tab actions (operate on active workspace)
      addTab: (shellType, workingDirectory) => {
        const state = get();
        const tabId = generateId("tab");

        const newTab: TabState = {
          id: tabId,
          shellType,
          workingDirectory: workingDirectory ?? null,
          title: getDefaultTitle(shellType),
          isLoading: true,
        };

        if (state.activeWorkspaceId === null) {
          // Add to default session
          set((s) => ({
            defaultSession: {
              ...s.defaultSession,
              tabs: [...s.defaultSession.tabs, newTab],
              activeTabId: tabId,
              updatedAt: Date.now(),
            },
          }));
        } else {
          // Add to active workspace
          set((s) => ({
            workspaces: s.workspaces.map((ws) =>
              ws.id === s.activeWorkspaceId
                ? {
                    ...ws,
                    tabs: [...ws.tabs, newTab],
                    activeTabId: tabId,
                    updatedAt: Date.now(),
                  }
                : ws
            ),
          }));
        }

        return tabId;
      },

      removeTab: (tabId) => {
        const state = get();
        const activeWs = state.getActiveWorkspace();
        const tabIndex = activeWs.tabs.findIndex((t) => t.id === tabId);
        if (tabIndex === -1) return;

        const newTabs = activeWs.tabs.filter((t) => t.id !== tabId);
        let newActiveTabId = activeWs.activeTabId;

        if (activeWs.activeTabId === tabId) {
          if (newTabs.length === 0) {
            newActiveTabId = null;
          } else if (tabIndex >= newTabs.length) {
            newActiveTabId = newTabs[newTabs.length - 1].id;
          } else {
            newActiveTabId = newTabs[tabIndex].id;
          }
        }

        if (state.activeWorkspaceId === null) {
          set((s) => ({
            defaultSession: {
              ...s.defaultSession,
              tabs: newTabs,
              activeTabId: newActiveTabId,
              updatedAt: Date.now(),
            },
          }));
        } else {
          set((s) => ({
            workspaces: s.workspaces.map((ws) =>
              ws.id === s.activeWorkspaceId
                ? { ...ws, tabs: newTabs, activeTabId: newActiveTabId, updatedAt: Date.now() }
                : ws
            ),
          }));
        }
      },

      setActiveTab: (tabId) => {
        const state = get();
        const activeWs = state.getActiveWorkspace();

        if (!activeWs.tabs.some((t) => t.id === tabId)) return;

        if (state.activeWorkspaceId === null) {
          set((s) => ({
            defaultSession: { ...s.defaultSession, activeTabId: tabId },
          }));
        } else {
          set((s) => ({
            workspaces: s.workspaces.map((ws) =>
              ws.id === s.activeWorkspaceId ? { ...ws, activeTabId: tabId } : ws
            ),
          }));
        }
      },

      updateTab: (tabId, updates) => {
        // Update tab in ANY workspace (not just active)
        // This is needed because terminals from all workspaces are rendered
        set((s) => {
          // Check if tab is in default session
          const inDefaultSession = s.defaultSession.tabs.some((t) => t.id === tabId);
          if (inDefaultSession) {
            return {
              defaultSession: {
                ...s.defaultSession,
                tabs: s.defaultSession.tabs.map((tab) =>
                  tab.id === tabId ? { ...tab, ...updates } : tab
                ),
              },
            };
          }

          // Check in workspaces
          return {
            workspaces: s.workspaces.map((ws) => ({
              ...ws,
              tabs: ws.tabs.map((tab) => (tab.id === tabId ? { ...tab, ...updates } : tab)),
            })),
          };
        });
      },

      reorderTabs: (fromIndex, toIndex) => {
        const state = get();
        const activeWs = state.getActiveWorkspace();

        const newTabs = [...activeWs.tabs];
        const [removed] = newTabs.splice(fromIndex, 1);
        newTabs.splice(toIndex, 0, removed);

        if (state.activeWorkspaceId === null) {
          set((s) => ({
            defaultSession: { ...s.defaultSession, tabs: newTabs },
          }));
        } else {
          set((s) => ({
            workspaces: s.workspaces.map((ws) =>
              ws.id === s.activeWorkspaceId ? { ...ws, tabs: newTabs } : ws
            ),
          }));
        }
      },

      reorderWorkspaces: (fromIndex, toIndex) => {
        set((state) => {
          const newWorkspaces = [...state.workspaces];
          const [removed] = newWorkspaces.splice(fromIndex, 1);
          newWorkspaces.splice(toIndex, 0, removed);
          return { workspaces: newWorkspaces };
        });
      },

      // Getters
      getActiveWorkspace: () => {
        const state = get();
        if (state.activeWorkspaceId === null) {
          return state.defaultSession;
        }
        return (
          state.workspaces.find((ws) => ws.id === state.activeWorkspaceId) ?? state.defaultSession
        );
      },

      getActiveTab: () => {
        const activeWs = get().getActiveWorkspace();
        return activeWs.tabs.find((t) => t.id === activeWs.activeTabId);
      },

      getTab: (tabId) => {
        // Search in ALL workspaces, not just active
        // This is needed because terminals from all workspaces are rendered
        const state = get();

        // Check default session first
        const inDefault = state.defaultSession.tabs.find((t) => t.id === tabId);
        if (inDefault) return inDefault;

        // Check all workspaces
        for (const ws of state.workspaces) {
          const found = ws.tabs.find((t) => t.id === tabId);
          if (found) return found;
        }

        return undefined;
      },

      getWorkspace: (workspaceId) => {
        if (workspaceId === DEFAULT_SESSION_ID) {
          return get().defaultSession;
        }
        return get().workspaces.find((ws) => ws.id === workspaceId);
      },

      // Tab navigation
      nextTab: () => {
        const state = get();
        const activeWs = state.getActiveWorkspace();
        if (activeWs.tabs.length === 0) return;

        const currentIndex = activeWs.tabs.findIndex((t) => t.id === activeWs.activeTabId);
        const nextIndex = (currentIndex + 1) % activeWs.tabs.length;
        state.setActiveTab(activeWs.tabs[nextIndex].id);
      },

      prevTab: () => {
        const state = get();
        const activeWs = state.getActiveWorkspace();
        if (activeWs.tabs.length === 0) return;

        const currentIndex = activeWs.tabs.findIndex((t) => t.id === activeWs.activeTabId);
        const prevIndex = (currentIndex - 1 + activeWs.tabs.length) % activeWs.tabs.length;
        state.setActiveTab(activeWs.tabs[prevIndex].id);
      },

      goToTab: (index) => {
        const state = get();
        const activeWs = state.getActiveWorkspace();
        if (index >= 1 && index <= activeWs.tabs.length) {
          state.setActiveTab(activeWs.tabs[index - 1].id);
        }
      },

      closeTabsToRight: (tabId) => {
        const state = get();
        const activeWs = state.getActiveWorkspace();
        const index = activeWs.tabs.findIndex((t) => t.id === tabId);
        if (index === -1) return;

        const newTabs = activeWs.tabs.slice(0, index + 1);
        const newActiveTabId =
          activeWs.activeTabId && newTabs.some((t) => t.id === activeWs.activeTabId)
            ? activeWs.activeTabId
            : (newTabs[newTabs.length - 1]?.id ?? null);

        if (state.activeWorkspaceId === null) {
          set((s) => ({
            defaultSession: { ...s.defaultSession, tabs: newTabs, activeTabId: newActiveTabId },
          }));
        } else {
          set((s) => ({
            workspaces: s.workspaces.map((ws) =>
              ws.id === s.activeWorkspaceId
                ? { ...ws, tabs: newTabs, activeTabId: newActiveTabId }
                : ws
            ),
          }));
        }
      },

      closeOtherTabs: (tabId) => {
        const state = get();
        const activeWs = state.getActiveWorkspace();
        const tab = activeWs.tabs.find((t) => t.id === tabId);
        if (!tab) return;

        if (state.activeWorkspaceId === null) {
          set((s) => ({
            defaultSession: { ...s.defaultSession, tabs: [tab], activeTabId: tabId },
          }));
        } else {
          set((s) => ({
            workspaces: s.workspaces.map((ws) =>
              ws.id === s.activeWorkspaceId ? { ...ws, tabs: [tab], activeTabId: tabId } : ws
            ),
          }));
        }
      },

      duplicateTab: (tabId) => {
        const state = get();
        const tab = state.getTab(tabId);
        if (!tab) return null;

        return state.addTab(tab.shellType, tab.workingDirectory ?? undefined);
      },
    }),
    {
      name: "connexio-session-v2",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        workspaces: state.workspaces.map((ws) => ({
          ...ws,
          tabs: ws.tabs.map((tab) => ({
            ...tab,
            ptyId: undefined,
            isLoading: undefined,
            hasExited: undefined,
            exitCode: undefined,
          })),
        })),
        activeWorkspaceId: state.activeWorkspaceId,
        defaultSession: {
          ...state.defaultSession,
          tabs: state.defaultSession.tabs.map((tab) => ({
            ...tab,
            ptyId: undefined,
            isLoading: undefined,
            hasExited: undefined,
            exitCode: undefined,
          })),
        },
        version: state.version,
      }),
      onRehydrateStorage: () => {
        return () => {
          // Mark as hydrated and notify listeners
          hasHydrated = true;
          hydrationListeners.forEach((cb) => cb());
          hydrationListeners.clear();
        };
      },
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

/**
 * Get active workspace session
 */
export const useActiveWorkspace = () => useSessionStore((state) => state.getActiveWorkspace());

/**
 * Get tabs for active workspace
 */
export const useTabs = () => {
  const activeWorkspaceId = useSessionStore((state) => state.activeWorkspaceId);
  const defaultSession = useSessionStore((state) => state.defaultSession);
  const workspaces = useSessionStore(useShallow((state) => state.workspaces));

  return useMemo(() => {
    if (activeWorkspaceId === null) {
      return defaultSession.tabs;
    }
    const ws = workspaces.find((w) => w.id === activeWorkspaceId);
    return ws?.tabs ?? [];
  }, [activeWorkspaceId, defaultSession.tabs, workspaces]);
};

/**
 * Get active tab ID for current workspace
 */
export const useActiveTabId = () => {
  const activeWorkspaceId = useSessionStore((state) => state.activeWorkspaceId);
  const defaultSession = useSessionStore((state) => state.defaultSession);
  const workspaces = useSessionStore(useShallow((state) => state.workspaces));

  return useMemo(() => {
    if (activeWorkspaceId === null) {
      return defaultSession.activeTabId;
    }
    const ws = workspaces.find((w) => w.id === activeWorkspaceId);
    return ws?.activeTabId ?? null;
  }, [activeWorkspaceId, defaultSession.activeTabId, workspaces]);
};

/**
 * Get active tab
 */
export const useActiveTab = () => {
  const tabs = useTabs();
  const activeTabId = useActiveTabId();

  return useMemo(() => {
    return tabs.find((t) => t.id === activeTabId);
  }, [tabs, activeTabId]);
};

/**
 * Get all workspaces
 */
export const useWorkspaces = () => {
  const workspaces = useSessionStore(useShallow((state) => state.workspaces));

  return useMemo(() => [...workspaces].sort((a, b) => b.updatedAt - a.updatedAt), [workspaces]);
};

/**
 * Get active workspace ID
 */
export const useActiveWorkspaceId = () => useSessionStore((state) => state.activeWorkspaceId);

/**
 * Check if there are unsaved changes in current workspace
 */
export const useHasUnsavedChanges = () => {
  // In session-based model, changes are always "saved" to the session
  // This hook can be used to track if current workspace has been modified
  // For now, always return false since sessions are auto-saved
  return false;
};

/**
 * Get all tabs from ALL workspaces (for rendering all terminals)
 */
export const useAllTabs = () => {
  const defaultSession = useSessionStore((state) => state.defaultSession);
  const workspaces = useSessionStore(useShallow((state) => state.workspaces));

  return useMemo(() => {
    const allTabs: Array<{ workspaceId: string | null; tab: TabState }> = [];

    // Add default session tabs
    defaultSession.tabs.forEach((tab) => {
      allTabs.push({ workspaceId: null, tab });
    });

    // Add workspace tabs
    workspaces.forEach((ws) => {
      ws.tabs.forEach((tab) => {
        allTabs.push({ workspaceId: ws.id, tab });
      });
    });

    return allTabs;
  }, [defaultSession.tabs, workspaces]);
};

/**
 * Hook to check if session store has been hydrated
 */
export const useSessionHydrated = () => {
  const [hydrated, setHydrated] = useState(hasHydrated);

  useEffect(() => {
    if (hasHydrated) {
      setHydrated(true);
      return;
    }

    const unsubscribe = onSessionHydrated(() => {
      setHydrated(true);
    });

    return unsubscribe;
  }, []);

  return hydrated;
};
