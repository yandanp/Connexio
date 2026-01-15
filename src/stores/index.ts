/**
 * Stores barrel export
 *
 * v1.2: Session-based workspaces - workspaceStore merged into sessionStore
 */

export {
  useSessionStore,
  useTabs,
  useActiveTabId,
  useActiveTab,
  useWorkspaces,
  useActiveWorkspaceId,
  useActiveWorkspace,
  useHasUnsavedChanges,
  useAllTabs,
  useSessionHydrated,
  isSessionHydrated,
  onSessionHydrated,
  getDefaultTitle,
} from "./sessionStore";

export type { TabState, WorkspaceSession, WorkspaceColorId } from "./sessionStore";
export { WORKSPACE_COLORS } from "./sessionStore";

export {
  useThemeStore,
  useCurrentTheme,
  useActiveThemeId,
  useXtermTheme,
  initializeTheme,
  getXtermTheme,
} from "./themeStore";

export { useSettingsStore, useSetting, useDefaultShell, DEFAULT_SETTINGS } from "./settingsStore";
export type { Settings, SettingsActions, SettingsStore } from "./settingsStore";
