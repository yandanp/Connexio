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
  isTauri,
} from "@/lib/tauri";
import { useActiveThemeId, getXtermTheme, useSettingsStore } from "@/stores";
import { THEMES } from "@/lib/themes";
import type { ShellType, PtyOutputPayload, PtyExitPayload } from "@/types/terminal.types";

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

  // Update terminal font size when setting changes - instant without re-render
  useEffect(() => {
    const term = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (term) {
      term.options.fontSize = fontSize;
      // Refit terminal after font size change to recalculate dimensions
      if (fitAddon) {
        fitAddon.fit();
        // Also resize PTY to match new dimensions
        const ptyId = ptyIdRef.current;
        if (ptyId) {
          const { rows, cols } = term;
          resizePty(ptyId, rows, cols).catch((e) => {
            console.error("Failed to resize PTY after font change:", e);
          });
        }
      }
    }
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
        await new Promise((resolve) => setTimeout(resolve, 200));

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
          scrollback: 10000, // NFR-P9: 10,000+ lines
          allowTransparency: true,
          allowProposedApi: true,
        });

        // Create fit addon for auto-resizing
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        fitAddonRef.current = fitAddon;

        // Open terminal in container
        term.open(containerRef.current!);

        // Try to load WebGL addon for better performance (NFR-P4: 60 FPS)
        try {
          const webglAddon = new WebglAddon();
          webglAddon.onContextLoss(() => {
            console.warn("WebGL context lost, falling back to canvas renderer");
            webglAddon.dispose();
          });
          term.loadAddon(webglAddon);
          webglAddonRef.current = webglAddon;
        } catch (e) {
          console.warn("WebGL addon failed to load, using canvas renderer:", e);
        }

        // Initial fit
        fitAddon.fit();

        terminalRef.current = term;

        // Get initial dimensions
        const { rows, cols } = term;

        // CRITICAL: Set up event listeners BEFORE spawning PTY to avoid race condition
        // Buffer to collect early output before ptyId is known
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
            // Buffer output received before we know our ptyId
            earlyOutputBuffer.push(JSON.stringify(payload));
          }
        });

        // Register GLOBAL exit listener
        unlistenExit = await onPtyExit((payload: PtyExitPayload) => {
          if (pendingPtyId && payload.ptyId === pendingPtyId) {
            term.write(
              `\r\n\x1b[90m[Process exited with code ${payload.exitCode ?? "unknown"}]\x1b[0m\r\n`
            );
            onExitRef.current?.(payload.exitCode);
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

        // Handle terminal input -> PTY
        term.onData(async (data) => {
          if (ptyIdRef.current) {
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

        // Store cleanup functions
        (term as any)._connexioCleanup = () => {
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
        // Call stored cleanup functions
        if ((term as any)._connexioCleanup) {
          (term as any)._connexioCleanup();
        }
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
      resizeTimeout = setTimeout(handleResize, 100);
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
