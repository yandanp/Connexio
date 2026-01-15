/**
 * Theme System Types
 *
 * Defines the complete theming architecture for Connexio.
 * Story 5.1: Create Theme CSS Architecture
 *
 * The theme system uses CSS variables for instant theme switching
 * without requiring page reload or component re-render.
 */

/**
 * Available theme identifiers
 * FR27: 5 built-in themes minimum
 * FR30: Light and dark options
 */
export type ThemeId = "dark" | "light" | "nord" | "dracula" | "tokyo-night";

/**
 * Theme mode for light/dark classification
 */
export type ThemeMode = "light" | "dark";

/**
 * ANSI terminal color palette (16 colors)
 * Used by xterm.js and terminal applications
 */
export interface TerminalColorPalette {
  /** Background color */
  background: string;
  /** Foreground/text color */
  foreground: string;
  /** Cursor color */
  cursor: string;
  /** Cursor accent (text color when cursor is over it) */
  cursorAccent: string;
  /** Selection background */
  selectionBackground: string;
  /** Selection foreground (optional, uses foreground if not set) */
  selectionForeground?: string;

  /** ANSI color 0 - Black */
  black: string;
  /** ANSI color 1 - Red */
  red: string;
  /** ANSI color 2 - Green */
  green: string;
  /** ANSI color 3 - Yellow */
  yellow: string;
  /** ANSI color 4 - Blue */
  blue: string;
  /** ANSI color 5 - Magenta */
  magenta: string;
  /** ANSI color 6 - Cyan */
  cyan: string;
  /** ANSI color 7 - White */
  white: string;

  /** ANSI color 8 - Bright Black */
  brightBlack: string;
  /** ANSI color 9 - Bright Red */
  brightRed: string;
  /** ANSI color 10 - Bright Green */
  brightGreen: string;
  /** ANSI color 11 - Bright Yellow */
  brightYellow: string;
  /** ANSI color 12 - Bright Blue */
  brightBlue: string;
  /** ANSI color 13 - Bright Magenta */
  brightMagenta: string;
  /** ANSI color 14 - Bright Cyan */
  brightCyan: string;
  /** ANSI color 15 - Bright White */
  brightWhite: string;
}

/**
 * UI color palette using HSL values
 * These map directly to CSS variables in globals.css
 * Format: "H S% L%" (e.g., "222.2 84% 4.9%")
 */
export interface UIColorPalette {
  /** Main background color */
  background: string;
  /** Main foreground/text color */
  foreground: string;
  /** Primary brand color */
  primary: string;
  /** Primary foreground (text on primary) */
  primaryForeground: string;
  /** Secondary background color */
  secondary: string;
  /** Secondary foreground */
  secondaryForeground: string;
  /** Accent color for highlights */
  accent: string;
  /** Accent foreground */
  accentForeground: string;
  /** Muted/disabled background */
  muted: string;
  /** Muted foreground */
  mutedForeground: string;
  /** Border color */
  border: string;
  /** Focus ring color */
  ring: string;
}

/**
 * Complete theme definition
 */
export interface Theme {
  /** Unique theme identifier */
  id: ThemeId;
  /** Display name for UI */
  name: string;
  /** Theme mode (light/dark) for system integration */
  mode: ThemeMode;
  /** UI colors (HSL format for CSS variables) */
  ui: UIColorPalette;
  /** Terminal colors (hex format for xterm.js) */
  terminal: TerminalColorPalette;
}

/**
 * Theme store state
 */
export interface ThemeState {
  /** Currently active theme ID */
  activeThemeId: ThemeId;
  /** Schema version for migrations */
  version: number;
}

/**
 * Theme store actions
 */
export interface ThemeActions {
  /** Set the active theme */
  setTheme: (themeId: ThemeId) => void;
  /** Get the current theme definition */
  getTheme: () => Theme;
  /** Get all available themes */
  getAllThemes: () => Theme[];
  /** Check if current theme is dark mode */
  isDarkMode: () => boolean;
}

/**
 * Combined theme store type
 */
export type ThemeStore = ThemeState & ThemeActions;

/**
 * Default theme configuration
 */
export const DEFAULT_THEME_ID: ThemeId = "tokyo-night";

/**
 * Theme schema version for migrations
 */
export const THEME_SCHEMA_VERSION = 1;
