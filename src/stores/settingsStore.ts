/**
 * Settings Store - Manages application settings with persistence
 *
 * Story 5.5: Build Settings Panel UI
 * Story 5.6: Implement Shell Settings
 * Story 5.8: Store Settings in %APPDATA%
 *
 * This store handles:
 * - Default shell preference
 * - Application behavior settings
 * - Settings persistence via Zustand
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ShellType } from "@/types/terminal.types";

/**
 * Application settings interface
 */
export interface Settings {
  /** Default shell for new tabs */
  defaultShell: ShellType;
  /** Terminal font size in pixels */
  fontSize: number;
  /** Whether to restore session on startup */
  restoreSession: boolean;
  /** Whether to confirm before closing last tab */
  confirmCloseLastTab: boolean;
  /** Tab behavior when closing last tab: 'close' app or 'new' tab */
  lastTabBehavior: "close" | "new";
  /** Show tab close button only on hover */
  showCloseOnHover: boolean;
  /** Schema version for migrations */
  version: number;
}

/**
 * Settings store actions
 */
export interface SettingsActions {
  /** Update a single setting */
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  /** Update multiple settings at once */
  setSettings: (settings: Partial<Settings>) => void;
  /** Reset all settings to defaults */
  resetSettings: () => void;
  /** Get all settings */
  getSettings: () => Settings;
}

export type SettingsStore = Settings & SettingsActions;

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: Settings = {
  defaultShell: "csh",
  fontSize: 14,
  restoreSession: true,
  confirmCloseLastTab: false,
  lastTabBehavior: "close",
  showCloseOnHover: false,
  version: 1,
};

/**
 * Settings store with persistence
 */
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // Default settings
      ...DEFAULT_SETTINGS,

      // Actions
      setSetting: (key, value) => {
        set({ [key]: value });
      },

      setSettings: (settings) => {
        set(settings);
      },

      resetSettings: () => {
        set(DEFAULT_SETTINGS);
      },

      getSettings: () => {
        const state = get();
        return {
          defaultShell: state.defaultShell,
          fontSize: state.fontSize,
          restoreSession: state.restoreSession,
          confirmCloseLastTab: state.confirmCloseLastTab,
          lastTabBehavior: state.lastTabBehavior,
          showCloseOnHover: state.showCloseOnHover,
          version: state.version,
        };
      },
    }),
    {
      name: "connexio-settings",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        defaultShell: state.defaultShell,
        fontSize: state.fontSize,
        restoreSession: state.restoreSession,
        confirmCloseLastTab: state.confirmCloseLastTab,
        lastTabBehavior: state.lastTabBehavior,
        showCloseOnHover: state.showCloseOnHover,
        version: state.version,
      }),
    }
  )
);

/**
 * Hook to get a specific setting
 */
export function useSetting<K extends keyof Settings>(key: K): Settings[K] {
  return useSettingsStore((state) => state[key]);
}

/**
 * Hook to get the default shell setting
 */
export const useDefaultShell = () => useSettingsStore((state) => state.defaultShell);
