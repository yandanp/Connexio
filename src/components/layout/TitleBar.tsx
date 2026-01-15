/**
 * TitleBar - Custom window title bar with controls
 *
 * Story 5.3: Integrated ThemePicker for theme selection
 * Story 5.5: Added settings button
 * Story 1.8: Added about button
 */

import { useState, useEffect, useRef } from "react";
import { getCurrentWindow, Window } from "@tauri-apps/api/window";
import { Minus, Square, Maximize2, X, Settings, Link2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemePicker } from "@/components/ui";

interface TitleBarProps {
  title?: string;
  /** Callback when settings button is clicked */
  onSettingsClick?: () => void;
  /** Callback when about button is clicked */
  onAboutClick?: () => void;
}

// Check if running in Tauri context
const isTauri = () => {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
};

export function TitleBar({ title = "Connexio", onSettingsClick, onAboutClick }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const appWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    if (!isTauri()) {
      console.warn("[TitleBar] Not running in Tauri context");
      return;
    }

    let unlisten: (() => void) | undefined;

    // Small delay to ensure Tauri APIs are ready
    const timer = setTimeout(async () => {
      try {
        const appWindow = getCurrentWindow();
        appWindowRef.current = appWindow;
        setIsReady(true);

        // Check initial maximized state
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);

        // Listen for resize events to update maximized state
        unlisten = await appWindow.onResized(async () => {
          const isMax = await appWindow.isMaximized();
          setIsMaximized(isMax);
        });
      } catch (e) {
        console.error("[TitleBar] Failed to initialize:", e);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      unlisten?.();
    };
  }, []);

  const handleMinimize = async () => {
    if (isReady) await appWindowRef.current?.minimize();
  };

  const handleMaximize = async () => {
    if (isReady) await appWindowRef.current?.toggleMaximize();
  };

  const handleClose = async () => {
    if (isReady) await appWindowRef.current?.close();
  };

  return (
    <>
      <div
        data-tauri-drag-region
        className={cn(
          "h-8 flex items-center justify-between",
          "bg-background border-b border-border",
          "select-none"
        )}
      >
        {/* App branding + title */}
        <div className="flex items-center gap-2 px-3" data-tauri-drag-region>
          {/* App logo + name */}
          <div className="flex items-center gap-1.5">
            <Link2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Connexio</span>
          </div>

          {/* Separator */}
          <span className="text-muted-foreground/50 mx-2 select-none">—</span>

          {/* Tab/page title */}
          <span className="text-sm text-muted-foreground truncate max-w-[300px]">{title}</span>
        </div>

        {/* Window controls */}
        <div className="flex h-full items-center">
          {/* About button */}
          <button
            className="h-full px-3 hover:bg-muted transition-colors flex items-center justify-center"
            onClick={onAboutClick}
            aria-label="About"
            title="About Connexio"
          >
            <Info className="h-3.5 w-3.5" />
          </button>

          {/* Settings button */}
          <button
            className="h-full px-3 hover:bg-muted transition-colors flex items-center justify-center"
            onClick={onSettingsClick}
            aria-label="Settings"
            title="Settings (Ctrl+,)"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>

          {/* Theme picker dropdown */}
          <ThemePicker side="bottom" align="end" />

          {/* Window buttons */}
          <button
            className="h-full px-4 hover:bg-muted transition-colors flex items-center justify-center"
            onClick={handleMinimize}
            aria-label="Minimize"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            className="h-full px-4 hover:bg-muted transition-colors flex items-center justify-center"
            onClick={handleMaximize}
            aria-label={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <Square className="h-3 w-3" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button
            className="h-full px-4 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center"
            onClick={handleClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
