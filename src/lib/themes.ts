/**
 * Built-in Theme Definitions
 *
 * Story 5.1: Theme CSS Architecture
 * Story 5.2: 5 Built-in Themes
 *
 * Each theme includes:
 * - UI colors in HSL format for Tailwind/CSS variables
 * - Terminal colors in hex for xterm.js
 *
 * Theme Collection:
 * - tokyo-night: Default dark theme with vibrant colors
 * - dark: Classic dark theme for low-light environments
 * - light: Clean light theme for daytime use
 * - nord: Arctic, bluish color palette
 * - dracula: Popular purple-accented dark theme
 */

import type { Theme, ThemeId } from "@/types/theme.types";

/**
 * Tokyo Night Theme
 * A clean, vibrant dark theme inspired by Tokyo's city lights
 * Default theme for Connexio
 */
export const tokyoNightTheme: Theme = {
  id: "tokyo-night",
  name: "Tokyo Night",
  mode: "dark",
  ui: {
    background: "222.2 84% 4.9%",
    foreground: "226 57% 81%",
    primary: "224 76% 73%",
    primaryForeground: "222.2 84% 4.9%",
    secondary: "232 17% 19%",
    secondaryForeground: "226 57% 81%",
    accent: "232 17% 19%",
    accentForeground: "226 57% 81%",
    muted: "232 17% 19%",
    mutedForeground: "228 15% 50%",
    border: "232 17% 19%",
    ring: "224 76% 73%",
  },
  terminal: {
    background: "#1a1b26",
    foreground: "#a9b1d6",
    cursor: "#c0caf5",
    cursorAccent: "#1a1b26",
    selectionBackground: "#33467c",
    selectionForeground: "#c0caf5",
    black: "#15161e",
    red: "#f7768e",
    green: "#9ece6a",
    yellow: "#e0af68",
    blue: "#7aa2f7",
    magenta: "#bb9af7",
    cyan: "#7dcfff",
    white: "#a9b1d6",
    brightBlack: "#414868",
    brightRed: "#f7768e",
    brightGreen: "#9ece6a",
    brightYellow: "#e0af68",
    brightBlue: "#7aa2f7",
    brightMagenta: "#bb9af7",
    brightCyan: "#7dcfff",
    brightWhite: "#c0caf5",
  },
};

/**
 * Dark Theme
 * Classic dark theme - neutral and easy on the eyes
 */
export const darkTheme: Theme = {
  id: "dark",
  name: "Dark",
  mode: "dark",
  ui: {
    background: "240 10% 4%",
    foreground: "0 0% 95%",
    primary: "0 0% 98%",
    primaryForeground: "240 10% 4%",
    secondary: "240 4% 16%",
    secondaryForeground: "0 0% 98%",
    accent: "240 4% 16%",
    accentForeground: "0 0% 98%",
    muted: "240 4% 16%",
    mutedForeground: "240 5% 65%",
    border: "240 4% 16%",
    ring: "240 5% 84%",
  },
  terminal: {
    background: "#0d0d0d",
    foreground: "#e0e0e0",
    cursor: "#ffffff",
    cursorAccent: "#0d0d0d",
    selectionBackground: "#404040",
    selectionForeground: "#ffffff",
    black: "#000000",
    red: "#ff5555",
    green: "#50fa7b",
    yellow: "#f1fa8c",
    blue: "#6272a4",
    magenta: "#ff79c6",
    cyan: "#8be9fd",
    white: "#bfbfbf",
    brightBlack: "#4d4d4d",
    brightRed: "#ff6e6e",
    brightGreen: "#69ff94",
    brightYellow: "#ffffa5",
    brightBlue: "#d6acff",
    brightMagenta: "#ff92df",
    brightCyan: "#a4ffff",
    brightWhite: "#ffffff",
  },
};

/**
 * Light Theme
 * Clean, professional light theme inspired by GitHub
 */
export const lightTheme: Theme = {
  id: "light",
  name: "Light",
  mode: "light",
  ui: {
    background: "0 0% 100%",
    foreground: "222.2 84% 4.9%",
    primary: "222.2 47.4% 11.2%",
    primaryForeground: "210 40% 98%",
    secondary: "210 40% 96.1%",
    secondaryForeground: "222.2 47.4% 11.2%",
    accent: "210 40% 96.1%",
    accentForeground: "222.2 47.4% 11.2%",
    muted: "210 40% 96.1%",
    mutedForeground: "215.4 16.3% 46.9%",
    border: "214.3 31.8% 91.4%",
    ring: "222.2 84% 4.9%",
  },
  terminal: {
    background: "#ffffff",
    foreground: "#24292e",
    cursor: "#24292e",
    cursorAccent: "#ffffff",
    selectionBackground: "#0366d6",
    selectionForeground: "#ffffff",
    black: "#24292e",
    red: "#d73a49",
    green: "#22863a",
    yellow: "#b08800",
    blue: "#0366d6",
    magenta: "#6f42c1",
    cyan: "#1b7c83",
    white: "#fafbfc",
    brightBlack: "#586069",
    brightRed: "#cb2431",
    brightGreen: "#28a745",
    brightYellow: "#dbab09",
    brightBlue: "#2188ff",
    brightMagenta: "#8a63d2",
    brightCyan: "#3192aa",
    brightWhite: "#ffffff",
  },
};

/**
 * Nord Theme
 * Arctic, bluish color palette inspired by the polar night
 */
export const nordTheme: Theme = {
  id: "nord",
  name: "Nord",
  mode: "dark",
  ui: {
    background: "220 16% 22%",
    foreground: "218 27% 88%",
    primary: "213 32% 52%",
    primaryForeground: "220 16% 22%",
    secondary: "220 17% 27%",
    secondaryForeground: "218 27% 88%",
    accent: "220 17% 27%",
    accentForeground: "218 27% 88%",
    muted: "220 17% 27%",
    mutedForeground: "219 14% 61%",
    border: "220 17% 27%",
    ring: "213 32% 52%",
  },
  terminal: {
    background: "#2e3440",
    foreground: "#d8dee9",
    cursor: "#d8dee9",
    cursorAccent: "#2e3440",
    selectionBackground: "#434c5e",
    selectionForeground: "#eceff4",
    black: "#3b4252",
    red: "#bf616a",
    green: "#a3be8c",
    yellow: "#ebcb8b",
    blue: "#81a1c1",
    magenta: "#b48ead",
    cyan: "#88c0d0",
    white: "#e5e9f0",
    brightBlack: "#4c566a",
    brightRed: "#bf616a",
    brightGreen: "#a3be8c",
    brightYellow: "#ebcb8b",
    brightBlue: "#81a1c1",
    brightMagenta: "#b48ead",
    brightCyan: "#8fbcbb",
    brightWhite: "#eceff4",
  },
};

/**
 * Dracula Theme
 * Popular dark theme with purple accents
 */
export const draculaTheme: Theme = {
  id: "dracula",
  name: "Dracula",
  mode: "dark",
  ui: {
    background: "231 15% 18%",
    foreground: "60 30% 96%",
    primary: "265 89% 78%",
    primaryForeground: "231 15% 18%",
    secondary: "232 14% 24%",
    secondaryForeground: "60 30% 96%",
    accent: "326 100% 74%",
    accentForeground: "231 15% 18%",
    muted: "232 14% 24%",
    mutedForeground: "228 8% 55%",
    border: "232 14% 24%",
    ring: "265 89% 78%",
  },
  terminal: {
    background: "#282a36",
    foreground: "#f8f8f2",
    cursor: "#f8f8f2",
    cursorAccent: "#282a36",
    selectionBackground: "#44475a",
    selectionForeground: "#f8f8f2",
    black: "#21222c",
    red: "#ff5555",
    green: "#50fa7b",
    yellow: "#f1fa8c",
    blue: "#bd93f9",
    magenta: "#ff79c6",
    cyan: "#8be9fd",
    white: "#f8f8f2",
    brightBlack: "#6272a4",
    brightRed: "#ff6e6e",
    brightGreen: "#69ff94",
    brightYellow: "#ffffa5",
    brightBlue: "#d6acff",
    brightMagenta: "#ff92df",
    brightCyan: "#a4ffff",
    brightWhite: "#ffffff",
  },
};

/**
 * All built-in themes indexed by ID
 */
export const THEMES: Record<ThemeId, Theme> = {
  "tokyo-night": tokyoNightTheme,
  dark: darkTheme,
  light: lightTheme,
  nord: nordTheme,
  dracula: draculaTheme,
};

/**
 * Get all themes as an array
 */
export function getAllThemes(): Theme[] {
  return Object.values(THEMES);
}

/**
 * Get a theme by ID
 */
export function getThemeById(id: ThemeId): Theme {
  return THEMES[id];
}

/**
 * Theme display order for UI
 */
export const THEME_ORDER: ThemeId[] = ["tokyo-night", "dark", "light", "nord", "dracula"];
