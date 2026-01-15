/**
 * Theme Store - Manages theme state with persistence
 *
 * Story 5.1: CSS Variable-based Theming Architecture
 * Story 5.4: Persist Theme Selection
 *
 * This store handles:
 * - Theme selection and persistence
 * - CSS variable application to document
 * - xterm.js theme object generation
 *
 * Uses Zustand with persist middleware for auto-save functionality.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ThemeId, Theme, ThemeStore, TerminalColorPalette } from "@/types/theme.types";
import { DEFAULT_THEME_ID, THEME_SCHEMA_VERSION } from "@/types/theme.types";
import { THEMES, getAllThemes } from "@/lib/themes";
import type { ITheme } from "@xterm/xterm";

/**
 * Apply theme CSS variables to document root
 * This enables instant theme switching without re-render
 */
function applyThemeCSSVariables(theme: Theme): void {
  const root = document.documentElement;

  // Apply UI colors (HSL format)
  root.style.setProperty("--background", theme.ui.background);
  root.style.setProperty("--foreground", theme.ui.foreground);
  root.style.setProperty("--primary", theme.ui.primary);
  root.style.setProperty("--primary-foreground", theme.ui.primaryForeground);
  root.style.setProperty("--secondary", theme.ui.secondary);
  root.style.setProperty("--secondary-foreground", theme.ui.secondaryForeground);
  root.style.setProperty("--accent", theme.ui.accent);
  root.style.setProperty("--accent-foreground", theme.ui.accentForeground);
  root.style.setProperty("--muted", theme.ui.muted);
  root.style.setProperty("--muted-foreground", theme.ui.mutedForeground);
  root.style.setProperty("--border", theme.ui.border);
  root.style.setProperty("--ring", theme.ui.ring);

  // Apply terminal colors (hex format)
  root.style.setProperty("--terminal-background", theme.terminal.background);
  root.style.setProperty("--terminal-foreground", theme.terminal.foreground);
  root.style.setProperty("--terminal-cursor", theme.terminal.cursor);
  root.style.setProperty("--terminal-cursor-accent", theme.terminal.cursorAccent);
  root.style.setProperty("--terminal-selection-bg", theme.terminal.selectionBackground);
  root.style.setProperty(
    "--terminal-selection-fg",
    theme.terminal.selectionForeground || theme.terminal.foreground
  );

  // ANSI colors - Normal
  root.style.setProperty("--terminal-black", theme.terminal.black);
  root.style.setProperty("--terminal-red", theme.terminal.red);
  root.style.setProperty("--terminal-green", theme.terminal.green);
  root.style.setProperty("--terminal-yellow", theme.terminal.yellow);
  root.style.setProperty("--terminal-blue", theme.terminal.blue);
  root.style.setProperty("--terminal-magenta", theme.terminal.magenta);
  root.style.setProperty("--terminal-cyan", theme.terminal.cyan);
  root.style.setProperty("--terminal-white", theme.terminal.white);

  // ANSI colors - Bright
  root.style.setProperty("--terminal-bright-black", theme.terminal.brightBlack);
  root.style.setProperty("--terminal-bright-red", theme.terminal.brightRed);
  root.style.setProperty("--terminal-bright-green", theme.terminal.brightGreen);
  root.style.setProperty("--terminal-bright-yellow", theme.terminal.brightYellow);
  root.style.setProperty("--terminal-bright-blue", theme.terminal.brightBlue);
  root.style.setProperty("--terminal-bright-magenta", theme.terminal.brightMagenta);
  root.style.setProperty("--terminal-bright-cyan", theme.terminal.brightCyan);
  root.style.setProperty("--terminal-bright-white", theme.terminal.brightWhite);

  // Update document class for light/dark mode
  root.classList.remove("light", "dark");
  root.classList.add(theme.mode);
}

/**
 * Convert theme terminal palette to xterm.js ITheme format
 */
export function getXtermTheme(palette: TerminalColorPalette): ITheme {
  return {
    background: palette.background,
    foreground: palette.foreground,
    cursor: palette.cursor,
    cursorAccent: palette.cursorAccent,
    selectionBackground: palette.selectionBackground,
    selectionForeground: palette.selectionForeground,
    black: palette.black,
    red: palette.red,
    green: palette.green,
    yellow: palette.yellow,
    blue: palette.blue,
    magenta: palette.magenta,
    cyan: palette.cyan,
    white: palette.white,
    brightBlack: palette.brightBlack,
    brightRed: palette.brightRed,
    brightGreen: palette.brightGreen,
    brightYellow: palette.brightYellow,
    brightBlue: palette.brightBlue,
    brightMagenta: palette.brightMagenta,
    brightCyan: palette.brightCyan,
    brightWhite: palette.brightWhite,
  };
}

/**
 * Theme store with persistence
 */
export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      // Initial state
      activeThemeId: DEFAULT_THEME_ID,
      version: THEME_SCHEMA_VERSION,

      // Actions
      setTheme: (themeId: ThemeId) => {
        const theme = THEMES[themeId];
        if (!theme) {
          console.error(`Theme "${themeId}" not found`);
          return;
        }

        // Apply CSS variables immediately
        applyThemeCSSVariables(theme);

        // Update state
        set({ activeThemeId: themeId });
      },

      getTheme: (): Theme => {
        const { activeThemeId } = get();
        return THEMES[activeThemeId] || THEMES[DEFAULT_THEME_ID];
      },

      getAllThemes: (): Theme[] => {
        return getAllThemes();
      },

      isDarkMode: (): boolean => {
        const theme = get().getTheme();
        return theme.mode === "dark";
      },
    }),
    {
      name: "connexio-theme",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeThemeId: state.activeThemeId,
        version: state.version,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          // Apply theme after rehydration
          if (state) {
            const theme = THEMES[state.activeThemeId] || THEMES[DEFAULT_THEME_ID];
            applyThemeCSSVariables(theme);
          }
        };
      },
    }
  )
);

/**
 * Hook to get the current theme
 */
export const useCurrentTheme = () => useThemeStore((state) => state.getTheme());

/**
 * Hook to get the active theme ID
 */
export const useActiveThemeId = () => useThemeStore((state) => state.activeThemeId);

/**
 * Hook to get the current xterm.js theme object
 */
export const useXtermTheme = (): ITheme => {
  const theme = useThemeStore((state) => state.getTheme());
  return getXtermTheme(theme.terminal);
};

/**
 * Initialize theme on app start
 * Call this early in the app lifecycle to prevent flash of wrong theme
 */
export function initializeTheme(): void {
  const state = useThemeStore.getState();
  const theme = state.getTheme();
  applyThemeCSSVariables(theme);
}
