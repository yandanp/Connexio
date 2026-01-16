/**
 * PTY (Pseudo-Terminal) related types
 *
 * These types mirror the Rust types for IPC communication.
 */

/**
 * Shell types supported by Connexio
 */
export type ShellType = "powershell" | "cmd" | "wsl" | "gitbash" | "csh";

/**
 * Configuration for spawning a new PTY session
 */
export interface PtySpawnConfig {
  /** The type of shell to spawn */
  shellType: ShellType;
  /** Initial working directory (optional) */
  workingDirectory?: string;
  /** Initial terminal size - rows */
  rows: number;
  /** Initial terminal size - columns */
  cols: number;
}

/**
 * PTY output event payload received from backend
 */
export interface PtyOutputPayload {
  /** The ID of the PTY session */
  ptyId: string;
  /** The output data (UTF-8 encoded) */
  data: string;
}

/**
 * PTY exit event payload received from backend
 */
export interface PtyExitPayload {
  /** The ID of the PTY session */
  ptyId: string;
  /** The exit code of the process (if available) */
  exitCode: number | null;
}

/**
 * PTY resize request
 */
export interface PtyResizeRequest {
  /** The ID of the PTY session */
  ptyId: string;
  /** New number of rows */
  rows: number;
  /** New number of columns */
  cols: number;
}

/**
 * Information about a PTY session
 */
export interface PtyInfo {
  /** Unique identifier for this PTY session */
  id: string;
  /** The shell type running in this PTY */
  shellType: ShellType;
  /** Current working directory (if known) */
  workingDirectory: string | null;
  /** Whether the PTY is still running */
  isAlive: boolean;
}

/**
 * Shell display information
 */
export interface ShellInfo {
  type: ShellType;
  name: string;
  available: boolean;
}

/**
 * Default PTY spawn configuration
 */
export const DEFAULT_PTY_CONFIG: PtySpawnConfig = {
  shellType: "powershell",
  rows: 24,
  cols: 80,
};

/**
 * Get display name for shell type
 */
export function getShellDisplayName(shellType: ShellType): string {
  const names: Record<ShellType, string> = {
    powershell: "PowerShell",
    cmd: "Command Prompt",
    wsl: "WSL",
    gitbash: "Git Bash",
    csh: "Connexio Shell",
  };
  return names[shellType];
}
