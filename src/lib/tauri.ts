/**
 * Tauri IPC wrapper functions
 *
 * This module provides type-safe wrappers around Tauri's invoke API
 * for communicating with the Rust backend.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import type {
  PtySpawnConfig,
  PtyOutputPayload,
  PtyExitPayload,
  PtyInfo,
  ShellType,
} from "@/types/terminal.types";

/**
 * Check if running in Tauri context
 * Tauri v2 uses __TAURI_INTERNALS__ or window.__TAURI__
 */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window || "ipc" in window;
}

/**
 * Spawn a new PTY session with full configuration
 *
 * @param config - The spawn configuration
 * @returns The unique PTY session ID
 */
export async function spawnShell(config: PtySpawnConfig): Promise<string> {
  return invoke<string>("spawn_shell", { config });
}

/**
 * Quick spawn with just shell type and optional working directory
 *
 * @param shellType - The type of shell to spawn
 * @param workingDirectory - Optional starting directory
 * @returns The unique PTY session ID
 */
export async function spawnDefaultShell(
  shellType: ShellType,
  workingDirectory?: string
): Promise<string> {
  return invoke<string>("spawn_default_shell", {
    shellType,
    workingDirectory,
  });
}

/**
 * Write data to a PTY session (terminal input)
 *
 * @param ptyId - The PTY session ID
 * @param data - The data to write (usually keystrokes)
 */
export async function writePty(ptyId: string, data: string): Promise<void> {
  return invoke<void>("write_pty", { ptyId, data });
}

/**
 * Resize a PTY session
 *
 * @param ptyId - The PTY session ID
 * @param rows - New number of rows
 * @param cols - New number of columns
 */
export async function resizePty(ptyId: string, rows: number, cols: number): Promise<void> {
  return invoke<void>("resize_pty", { ptyId, rows, cols });
}

/**
 * Kill a PTY session
 *
 * @param ptyId - The PTY session ID to kill
 */
export async function killPty(ptyId: string): Promise<void> {
  return invoke<void>("kill_pty", { ptyId });
}

/**
 * Get information about a PTY session
 *
 * @param ptyId - The PTY session ID
 * @returns PTY info or null if not found
 */
export async function getPtyInfo(ptyId: string): Promise<PtyInfo | null> {
  return invoke<PtyInfo | null>("get_pty_info", { ptyId });
}

/**
 * List all active PTY sessions
 *
 * @returns Array of PTY session IDs
 */
export async function listPtySessions(): Promise<string[]> {
  return invoke<string[]>("list_pty_sessions");
}

/**
 * Listen for PTY output events
 *
 * @param callback - Function to call when output is received
 * @returns Unlisten function to stop listening
 */
export async function onPtyOutput(
  callback: (payload: PtyOutputPayload) => void
): Promise<UnlistenFn> {
  return listen<PtyOutputPayload>("pty-output", (event) => {
    callback(event.payload);
  });
}

/**
 * Listen for PTY exit events
 *
 * @param callback - Function to call when a PTY exits
 * @returns Unlisten function to stop listening
 */
export async function onPtyExit(callback: (payload: PtyExitPayload) => void): Promise<UnlistenFn> {
  return listen<PtyExitPayload>("pty-exit", (event) => {
    callback(event.payload);
  });
}

/**
 * Listen for PTY output from a specific session
 *
 * @param ptyId - The PTY session ID to listen for
 * @param callback - Function to call when output is received
 * @returns Unlisten function to stop listening
 */
export async function onPtyOutputById(
  ptyId: string,
  callback: (data: string) => void
): Promise<UnlistenFn> {
  return listen<PtyOutputPayload>("pty-output", (event) => {
    if (event.payload.ptyId === ptyId) {
      callback(event.payload.data);
    }
  });
}

/**
 * Listen for PTY exit from a specific session
 *
 * @param ptyId - The PTY session ID to listen for
 * @param callback - Function to call when the PTY exits
 * @returns Unlisten function to stop listening
 */
export async function onPtyExitById(
  ptyId: string,
  callback: (exitCode: number | null) => void
): Promise<UnlistenFn> {
  return listen<PtyExitPayload>("pty-exit", (event) => {
    if (event.payload.ptyId === ptyId) {
      callback(event.payload.exitCode);
    }
  });
}

// ============================================================================
// CLI / Startup Configuration
// ============================================================================

/**
 * Startup configuration from CLI arguments
 */
export interface StartupConfig {
  /** Working directory for the initial tab */
  working_directory: string | null;
  /** Command to execute in the initial tab */
  execute_command: string | null;
  /** Whether to skip session restore */
  skip_session_restore: boolean;
}

/**
 * Get the startup configuration from CLI arguments
 * This is set by the Rust backend when the app starts with CLI args
 *
 * @returns Startup config or null if no CLI args were provided
 */
export async function getStartupConfig(): Promise<StartupConfig | null> {
  return invoke<StartupConfig | null>("get_startup_config");
}

/**
 * Clear the startup configuration after it's been consumed
 * This prevents the CLI args from being reused on subsequent checks
 */
export async function clearStartupConfig(): Promise<void> {
  return invoke<void>("clear_startup_config");
}

// ============================================================================
// App Info
// ============================================================================

/**
 * Get app version from Tauri
 */
export async function getAppVersion(): Promise<string> {
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    return getVersion();
  } catch {
    return "0.1.0"; // Fallback version
  }
}

/**
 * Get app name from Tauri
 */
export async function getAppName(): Promise<string> {
  try {
    const { getName } = await import("@tauri-apps/api/app");
    return getName();
  } catch {
    return "Connexio"; // Fallback name
  }
}

/**
 * Get Tauri version
 */
export async function getTauriVersion(): Promise<string> {
  try {
    const { getTauriVersion: getTauriVer } = await import("@tauri-apps/api/app");
    return getTauriVer();
  } catch {
    return "2.x"; // Fallback
  }
}
