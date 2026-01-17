/**
 * TerminalViewport - xterm.js based terminal component
 *
 * This component renders an interactive terminal using xterm.js with WebGL
 * acceleration, connected to a PTY backend via Tauri IPC.
 *
 * Story 1.3: Implement Basic Terminal UI with xterm.js
 * Story 5.1: CSS Variable-based Theming (dynamic theme support)
 */

import { useEffect, useRef, useCallback, useState, useLayoutEffect } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";

import {
  spawnDefaultShell,
  writePty,
  resizePty,
  onPtyOutput,
  onPtyExit,
  killPty,
  killChildProcesses,
  isTauri,
} from "@/lib/tauri";
import { useActiveThemeId, getXtermTheme, useSettingsStore } from "@/stores";
import { THEMES } from "@/lib/themes";
import type { ShellType, PtyOutputPayload, PtyExitPayload } from "@/types/terminal.types";

// =============================================================================
// CONSTANTS - Extracted from magic numbers for maintainability
// =============================================================================

/** Delay for WebGL glyph atlas rebuild after font size change (ms) */
const WEBGL_FONT_REBUILD_DELAY_MS = 50;

/** Delay before loading WebGL addon to prevent flickering (ms) - CURRENTLY UNUSED, WebGL disabled */
// const WEBGL_LOAD_DELAY_MS = 100;

/** Delay to wait for Tauri context to be ready (ms) */
const TAURI_READY_DELAY_MS = 200;

/** Debounce delay for window resize events (ms) */
const RESIZE_DEBOUNCE_MS = 100;

/** Time threshold for detecting double Ctrl+C press (ms) */
const DOUBLE_CTRL_C_THRESHOLD_MS = 500;

/** Maximum number of buffered output payloads before PTY ID is known */
const MAX_EARLY_OUTPUT_BUFFER_SIZE = 100;

/** Default scrollback buffer size (lines) - NFR-P9 requirement */
const DEFAULT_SCROLLBACK_LINES = 10000;

// =============================================================================
// TYPE-SAFE TERMINAL EXTRAS - Replaces (term as any) anti-pattern
// =============================================================================

/**
 * Extra data associated with a Terminal instance.
 * Uses WeakMap for automatic garbage collection when Terminal is disposed.
 */
interface TerminalExtras {
  fontSizeTimeout?: ReturnType<typeof setTimeout>;
  webglLoadDelay?: ReturnType<typeof setTimeout>;
  cleanup?: () => void;
}

/** WeakMap to store terminal extras without polluting Terminal prototype */
const terminalExtrasMap = new WeakMap<Terminal, TerminalExtras>();

/** Get or create extras for a terminal instance */
function getTerminalExtras(term: Terminal): TerminalExtras {
  let extras = terminalExtrasMap.get(term);
  if (!extras) {
    extras = {};
    terminalExtrasMap.set(term, extras);
  }
  return extras;
}

/** Clear all timeouts stored in terminal extras */
function clearTerminalExtras(term: Terminal): void {
  const extras = terminalExtrasMap.get(term);
  if (extras) {
    if (extras.fontSizeTimeout) clearTimeout(extras.fontSizeTimeout);
    if (extras.webglLoadDelay) clearTimeout(extras.webglLoadDelay);
    if (extras.cleanup) extras.cleanup();
    terminalExtrasMap.delete(term);
  }
}

export interface TerminalViewportProps {
  /** Shell type to spawn */
  shellType?: ShellType;
  /** Initial working directory */
  workingDirectory?: string;
  /** Callback when terminal is ready */
  onReady?: (ptyId: string) => void;
  /** Callback when terminal exits */
  onExit?: (exitCode: number | null) => void;
  /** Callback when title changes (from OSC sequences) */
  onTitleChange?: (title: string) => void;
  /** Callback when working directory changes (from OSC 7) */
  onCwdChange?: (cwd: string) => void;
  /** Whether this terminal is active/focused */
  isActive?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Parse OSC 7 sequence to extract working directory
 * Format: \x1b]7;file://hostname/path\x07 or \x1b]7;file://hostname/path\x1b\\
 */
function parseOsc7(data: string): string | null {
  // Match OSC 7 pattern: ESC ] 7 ; file://host/path BEL or ESC ] 7 ; file://host/path ESC \
  const osc7Regex = /\x1b\]7;file:\/\/[^\/]*([^\x07\x1b]+)(?:\x07|\x1b\\)/g;
  let match;
  let lastPath: string | null = null;

  while ((match = osc7Regex.exec(data)) !== null) {
    // Decode URL-encoded path
    try {
      lastPath = decodeURIComponent(match[1]);
    } catch {
      lastPath = match[1];
    }
  }

  return lastPath;
}

/**
 * Extract working directory from shell prompt in output
 * Supports:
 * - PowerShell: "PS C:\Users\Name>" or "PS D:\Project>"
 * - CMD: "C:\Users\Name>" or "D:\Project>"
 * - WSL/Git Bash: "user@host:/path$" or "/path$"
 */
function extractCwdFromOutput(data: string): string | null {
  // PowerShell prompt: PS C:\path> or PS D:\path>
  const psMatch = data.match(/PS\s+([A-Za-z]:\\[^>]*?)>/);
  if (psMatch) {
    return psMatch[1].trim();
  }

  // CMD prompt: C:\path> or D:\path> (at start of line or after newline)
  const cmdMatch = data.match(/(?:^|\n|\r)([A-Za-z]:\\[^>]*?)>/);
  if (cmdMatch) {
    return cmdMatch[1].trim();
  }

  // WSL/Git Bash: user@host:~$ or user@host:/path$ or just /path$
  const bashMatch = data.match(/(?:^|\n|\r)(?:[^@]+@[^:]+:)?([~\/][^\$\n\r]*?)\$/);
  if (bashMatch) {
    let path = bashMatch[1].trim();
    // Expand ~ to home (we can't know the exact path, so keep it as-is)
    return path;
  }

  return null;
}

export function TerminalViewport({
  shellType = "powershell",
  workingDirectory,
  onReady,
  onExit,
  onTitleChange,
  onCwdChange,
  isActive = true,
  className = "",
}: TerminalViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const webglAddonRef = useRef<WebglAddon | null>(null);
  const ptyIdRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get current theme ID from store for dynamic theming
  const activeThemeId = useActiveThemeId();

  // Get fontSize from settings store for dynamic font sizing
  const fontSize = useSettingsStore((state) => state.fontSize);

  // Store initial fontSize - only used once at Terminal creation
  const initialFontSizeRef = useRef(fontSize);

  // Store initial working directory - only used once at spawn
  const initialWorkingDirectoryRef = useRef(workingDirectory);

  // Use refs for callbacks to avoid re-initialization on callback changes
  const onReadyRef = useRef(onReady);
  const onExitRef = useRef(onExit);
  const onTitleChangeRef = useRef(onTitleChange);
  const onCwdChangeRef = useRef(onCwdChange);

  // Keep refs updated with latest callbacks
  useLayoutEffect(() => {
    onReadyRef.current = onReady;
    onExitRef.current = onExit;
    onTitleChangeRef.current = onTitleChange;
    onCwdChangeRef.current = onCwdChange;
  }, [onReady, onExit, onTitleChange, onCwdChange]);

  // Update terminal theme when theme changes - instant without re-render
  useEffect(() => {
    const term = terminalRef.current;
    if (term) {
      // Get fresh theme from store to ensure we have the latest
      const theme = THEMES[activeThemeId];
      if (theme) {
        const newTheme = getXtermTheme(theme.terminal);
        term.options.theme = newTheme;
      }
    }
  }, [activeThemeId]);

  // Update terminal font size when setting changes - with proper debounce for WebGL
  useEffect(() => {
    const term = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    const webglAddon = webglAddonRef.current;

    if (!term) return;

    // Set font size immediately
    term.options.fontSize = fontSize;

    // Use requestAnimationFrame to wait for render cycle, then fit
    // This gives WebGL time to rebuild glyph atlas with new font size
    const rafId = requestAnimationFrame(() => {
      // Additional delay for WebGL glyph atlas rebuild
      const timeoutId = setTimeout(() => {
        if (fitAddon) {
          try {
            fitAddon.fit();

            // Resize PTY to match new dimensions
            const ptyId = ptyIdRef.current;
            if (ptyId) {
              const { rows, cols } = term;
              resizePty(ptyId, rows, cols).catch((e) => {
                console.error("Failed to resize PTY after font change:", e);
              });
            }

            // Force WebGL to refresh if available
            if (webglAddon) {
              try {
                // Clear texture atlas cache by triggering a refresh
                term.refresh(0, term.rows - 1);
              } catch (e) {
                console.warn("WebGL refresh failed:", e);
              }
            }
          } catch (e) {
            console.error("Failed to fit terminal after font change:", e);
          }
        }
      }, WEBGL_FONT_REBUILD_DELAY_MS);

      // Store timeout for cleanup using type-safe WeakMap
      getTerminalExtras(term).fontSizeTimeout = timeoutId;
    });

    return () => {
      cancelAnimationFrame(rafId);
      const extras = terminalExtrasMap.get(term);
      if (extras?.fontSizeTimeout) {
        clearTimeout(extras.fontSizeTimeout);
      }
    };
  }, [fontSize]);

  // Initialize terminal - only run once per shellType/workingDirectory combination
  useEffect(() => {
    if (!containerRef.current) return;

    // Prevent re-initialization if already initialized
    if (terminalRef.current) {
      return;
    }

    // Track cleanup functions for proper teardown
    let unlistenOutput: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;
    let isCleanedUp = false;

    const initTerminal = async () => {
      // Wait a bit for Tauri to be ready
      if (!isTauri()) {
        await new Promise((resolve) => setTimeout(resolve, TAURI_READY_DELAY_MS));

        if (!isTauri()) {
          console.warn("[Terminal] Not running in Tauri context");
          setError("Not running in Tauri context");
          return;
        }
      }

      if (isCleanedUp) return; // Don't initialize if already cleaned up

      try {
        // Create terminal instance with optimized settings
        // Use current theme from store for initial rendering
        const initialTheme = THEMES[activeThemeId] || THEMES["tokyo-night"];
        const term = new Terminal({
          cursorBlink: true,
          cursorStyle: "block",
          fontSize: initialFontSizeRef.current,
          fontFamily: '"JetBrains Mono", "Cascadia Code", "Consolas", monospace',
          theme: getXtermTheme(initialTheme.terminal),
          scrollback: DEFAULT_SCROLLBACK_LINES,
          allowTransparency: true,
          allowProposedApi: true,
        });

        // Create fit addon for auto-resizing
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        fitAddonRef.current = fitAddon;

        // Open terminal in container
        term.open(containerRef.current!);

        // Initial fit BEFORE WebGL to establish correct dimensions
        fitAddon.fit();

        // DISABLED: WebGL addon causes rendering artifacts (characters "sticking")
        // during scrolling with long output (e.g., OpenCode sessions).
        // Issue: WebGL texture atlas corruption when buffer is large + rapid scroll.
        // TODO: Re-enable with smart fallback in v1.1 (switch to Canvas on heavy output)
        // See: https://github.com/xtermjs/xterm.js/issues/2790
        //
        // Original code (NFR-P4: 60 FPS target):
        // const webglLoadDelay = setTimeout(() => {
        //   if (isCleanedUp) return;
        //   try {
        //     const webglAddon = new WebglAddon();
        //     webglAddon.onContextLoss(() => {
        //       console.warn("WebGL context lost, falling back to canvas renderer");
        //       webglAddon.dispose();
        //       webglAddonRef.current = null;
        //     });
        //     term.loadAddon(webglAddon);
        //     webglAddonRef.current = webglAddon;
        //     requestAnimationFrame(() => {
        //       if (!isCleanedUp && term) {
        //         term.refresh(0, term.rows - 1);
        //       }
        //     });
        //   } catch (e) {
        //     console.warn("WebGL addon failed to load, using canvas renderer:", e);
        //   }
        // }, WEBGL_LOAD_DELAY_MS);
        // getTerminalExtras(term).webglLoadDelay = webglLoadDelay;

        // Using Canvas renderer instead - more stable for long sessions
        console.log("[Terminal] Using Canvas renderer (WebGL disabled for stability)");

        terminalRef.current = term;

        // Get initial dimensions
        const { rows, cols } = term;

        // CRITICAL: Set up event listeners BEFORE spawning PTY to avoid race condition
        // Buffer to collect early output before ptyId is known (with size limit to prevent unbounded growth)
        let pendingPtyId: string | null = null;
        const earlyOutputBuffer: string[] = [];

        // Register GLOBAL listener first - this catches ALL pty-output events
        unlistenOutput = await onPtyOutput((payload: PtyOutputPayload) => {
          // Skip if component is cleaned up
          if (isCleanedUp) return;

          // Once we know our ptyId, filter by it
          if (pendingPtyId && payload.ptyId === pendingPtyId) {
            term.write(payload.data);

            // Try to extract CWD from output (prompt parsing)
            const cwdFromOutput = extractCwdFromOutput(payload.data);
            if (cwdFromOutput) {
              onCwdChangeRef.current?.(cwdFromOutput);
            } else {
              // Fallback: Parse OSC 7 for CWD changes
              const newCwd = parseOsc7(payload.data);
              if (newCwd) {
                onCwdChangeRef.current?.(newCwd);
              }
            }
          } else if (!pendingPtyId) {
            // Buffer output received before we know our ptyId (with size limit)
            if (earlyOutputBuffer.length < MAX_EARLY_OUTPUT_BUFFER_SIZE) {
              earlyOutputBuffer.push(JSON.stringify(payload));
            } else {
              console.warn("[Terminal] Early output buffer full, dropping output");
            }
          }
        });

        // Register GLOBAL exit listener with auto-respawn
        unlistenExit = await onPtyExit(async (payload: PtyExitPayload) => {
          if (pendingPtyId && payload.ptyId === pendingPtyId) {
            // Skip if component is cleaned up
            if (isCleanedUp) return;

            term.write(
              `\r\n\x1b[90m[Process exited with code ${payload.exitCode ?? "unknown"}]\x1b[0m\r\n`
            );
            onExitRef.current?.(payload.exitCode);

            // Auto-respawn a new shell
            try {
              term.write("\x1b[90m[Restarting shell...]\x1b[0m\r\n\r\n");

              const newPtyId = await spawnDefaultShell(
                shellType,
                initialWorkingDirectoryRef.current
              );
              pendingPtyId = newPtyId;
              ptyIdRef.current = newPtyId;

              // Resize new PTY to match current terminal dimensions
              const { rows: currentRows, cols: currentCols } = term;
              await resizePty(newPtyId, currentRows, currentCols);

              // Reset title to shell type (remove any [exited] suffix)
              const shellName =
                shellType === "csh"
                  ? "CSH"
                  : shellType === "powershell"
                    ? "PowerShell"
                    : shellType === "cmd"
                      ? "Command Prompt"
                      : shellType === "wsl"
                        ? "WSL"
                        : shellType === "gitbash"
                          ? "Git Bash"
                          : "Terminal";
              onTitleChangeRef.current?.(shellName);

              console.log("[Terminal] Shell respawned with new PTY ID:", newPtyId);
              onReadyRef.current?.(newPtyId);
            } catch (e) {
              console.error("[Terminal] Failed to respawn shell:", e);
              term.write(`\r\n\x1b[1;31m[Failed to restart shell: ${e}]\x1b[0m\r\n`);
            }
          }
        });

        // NOW spawn PTY - listeners are already active
        // Use initial working directory from ref (not the prop, which may have changed)
        const ptyId = await spawnDefaultShell(shellType, initialWorkingDirectoryRef.current);
        pendingPtyId = ptyId;
        ptyIdRef.current = ptyId;

        // Replay any buffered output that matches our ptyId
        for (const buffered of earlyOutputBuffer) {
          try {
            const payload = JSON.parse(buffered) as PtyOutputPayload;
            if (payload.ptyId === ptyId) {
              term.write(payload.data);
            }
          } catch (e) {
            console.error("[Terminal] Failed to parse buffered output:", e);
          }
        }

        // Resize PTY to match terminal dimensions
        await resizePty(ptyId, rows, cols);

        // Track last Ctrl+C time for double-press force kill
        let lastCtrlCTime = 0;

        // Custom key event handler to ensure control keys are properly handled
        term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
          // Only handle keydown events
          if (event.type !== "keydown") {
            return true;
          }

          // Ctrl+Shift+K - Force Kill Child Processes
          if (event.ctrlKey && event.shiftKey && (event.key === "k" || event.key === "K")) {
            const currentPtyId = ptyIdRef.current;
            if (currentPtyId) {
              console.log("[Terminal] Ctrl+Shift+K - killing child processes");
              killChildProcesses(currentPtyId)
                .then((count) => console.log(`[Terminal] Killed ${count} child process(es)`))
                .catch((e) => console.error("[Terminal] Failed to kill child processes:", e));
            }
            return false;
          }

          // Allow browser copy/paste shortcuts with Shift
          if (event.ctrlKey && event.shiftKey) {
            if (event.key === "C" || event.key === "V") {
              return false; // Let browser handle Ctrl+Shift+C/V for copy/paste
            }
          }

          // For Ctrl+C - copy if selection, send interrupt, or force kill on double-press
          if (event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
            if (event.key === "c" || event.key === "C") {
              // Check if there's a selection - if so, copy to clipboard
              const selection = term.getSelection();
              if (selection && selection.length > 0) {
                navigator.clipboard.writeText(selection).catch(console.error);
                term.clearSelection();
                return false;
              }

              const now = Date.now();
              const currentPtyId = ptyIdRef.current;

              if (currentPtyId) {
                // Check for double Ctrl+C (within threshold) - kill child processes only
                if (now - lastCtrlCTime < DOUBLE_CTRL_C_THRESHOLD_MS) {
                  console.log("[Terminal] Double Ctrl+C - killing child processes");
                  killChildProcesses(currentPtyId)
                    .then((count) => {
                      if (count > 0) {
                        console.log(`[Terminal] Killed ${count} child process(es)`);
                      } else {
                        // No child processes found, send another \x03
                        console.log("[Terminal] No child processes found, sending Ctrl+C again");
                        writePty(currentPtyId, "\x03").catch(console.error);
                      }
                    })
                    .catch((e) => console.error("[Terminal] Failed to kill child processes:", e));
                  lastCtrlCTime = 0;
                  return false;
                }

                // Single Ctrl+C - send \x03 to PTY
                // This works for most programs, but some Windows programs (like ping) may not respond
                lastCtrlCTime = now;
                writePty(currentPtyId, "\x03").catch(console.error);
              }
              return false;
            }
          }

          // For Ctrl+V, handle paste manually
          if (event.ctrlKey && !event.shiftKey && (event.key === "v" || event.key === "V")) {
            navigator.clipboard
              .readText()
              .then((text) => {
                if (text && ptyIdRef.current) {
                  writePty(ptyIdRef.current, text).catch(console.error);
                }
              })
              .catch(console.error);
            return false;
          }

          // Let xterm handle all other keys
          return true;
        });

        // Handle terminal input -> PTY
        term.onData(async (data) => {
          if (ptyIdRef.current) {
            // Debug log for control characters
            if (data.length === 1 && data.charCodeAt(0) < 32) {
              console.log(
                `[Terminal] onData received control char: 0x${data.charCodeAt(0).toString(16).padStart(2, "0")} (Ctrl+${String.fromCharCode(data.charCodeAt(0) + 64)})`
              );
            }
            try {
              await writePty(ptyIdRef.current, data);
            } catch (e) {
              console.error("Failed to write to PTY:", e);
            }
          }
        });

        // Handle title changes (OSC sequences)
        term.onTitleChange((title) => {
          onTitleChangeRef.current?.(title);
        });

        // Store cleanup functions using type-safe WeakMap
        getTerminalExtras(term).cleanup = () => {
          unlistenOutput?.();
          unlistenExit?.();
        };

        onReadyRef.current?.(ptyId);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("[Terminal] Failed to initialize:", errorMessage);
        setError(errorMessage);

        // Cleanup listeners if spawn failed
        unlistenOutput?.();
        unlistenExit?.();
      }
    };

    initTerminal();

    // Cleanup on unmount
    return () => {
      isCleanedUp = true;
      const term = terminalRef.current;
      const ptyId = ptyIdRef.current;

      if (term) {
        // Use type-safe clearTerminalExtras to clean up all stored data
        clearTerminalExtras(term);
        term.dispose();
      }

      if (ptyId) {
        killPty(ptyId).catch((e) => {
          console.error("Failed to kill PTY:", e);
        });
      }

      terminalRef.current = null;
      fitAddonRef.current = null;
      webglAddonRef.current = null;
      ptyIdRef.current = null;
    };
    // Note: Only shellType triggers re-init. workingDirectory is only used at initial spawn.
    // Callbacks excluded from deps - using refs instead to prevent re-init.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shellType]);

  // Handle resize
  const handleResize = useCallback(() => {
    const term = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    const ptyId = ptyIdRef.current;

    if (!term || !fitAddon || !ptyId) return;

    // Fit terminal to container
    fitAddon.fit();

    // Get new dimensions and resize PTY
    const { rows, cols } = term;
    resizePty(ptyId, rows, cols).catch((e) => {
      console.error("Failed to resize PTY:", e);
    });
  }, []);

  // Handle window resize with debounce
  useEffect(() => {
    let resizeTimeout: ReturnType<typeof setTimeout>;

    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, RESIZE_DEBOUNCE_MS);
    };

    window.addEventListener("resize", debouncedResize);

    // Also use ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(debouncedResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", debouncedResize);
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
    };
  }, [handleResize]);

  // Focus terminal when active
  useEffect(() => {
    if (isActive && terminalRef.current) {
      terminalRef.current.focus();
    }
  }, [isActive]);

  // Error display
  if (error) {
    return (
      <div className={`flex items-center justify-center h-full bg-terminal-bg ${className}`}>
        <div className="text-center p-4">
          <p className="text-red-400 font-medium">Failed to initialize terminal</p>
          <p className="text-muted-foreground text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`h-full w-full terminal-viewport ${className}`}
      style={{
        padding: "4px 8px",
        backgroundColor: "var(--terminal-background)",
      }}
    />
  );
}
