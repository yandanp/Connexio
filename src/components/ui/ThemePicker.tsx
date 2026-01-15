/**
 * ThemePicker - Theme selection component with live preview
 *
 * Story 5.3: Build Theme Picker with Live Preview
 *
 * Features:
 * - Visual swatches for each theme
 * - Live preview on hover
 * - Revert on cancel (close without selecting)
 * - Keyboard navigation support
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Check, Palette, Sun, Moon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useThemeStore, useActiveThemeId } from "@/stores";
import { THEMES, THEME_ORDER } from "@/lib/themes";
import type { ThemeId, Theme } from "@/types/theme.types";
import { cn } from "@/lib/utils";

interface ThemeSwatchProps {
  theme: Theme;
  size?: "sm" | "md";
}

/**
 * Visual swatch showing theme colors
 */
function ThemeSwatch({ theme, size = "md" }: ThemeSwatchProps) {
  const sizeClass = size === "sm" ? "w-4 h-4" : "w-6 h-6";

  return (
    <div
      className={cn("rounded-md overflow-hidden border border-border/50 flex", sizeClass)}
      title={theme.name}
    >
      {/* Background color - main area */}
      <div className="flex-1 h-full" style={{ backgroundColor: theme.terminal.background }} />
      {/* Accent colors strip */}
      <div className="w-1/3 h-full flex flex-col">
        <div className="flex-1" style={{ backgroundColor: theme.terminal.blue }} />
        <div className="flex-1" style={{ backgroundColor: theme.terminal.green }} />
        <div className="flex-1" style={{ backgroundColor: theme.terminal.magenta }} />
      </div>
    </div>
  );
}

interface ThemePickerProps {
  /** Custom trigger element */
  trigger?: React.ReactNode;
  /** Side for dropdown positioning */
  side?: "top" | "right" | "bottom" | "left";
  /** Alignment for dropdown positioning */
  align?: "start" | "center" | "end";
  /** Called when theme is applied */
  onThemeChange?: (themeId: ThemeId) => void;
}

/**
 * Theme picker dropdown with live preview
 */
export function ThemePicker({
  trigger,
  side = "bottom",
  align = "end",
  onThemeChange,
}: ThemePickerProps) {
  const activeThemeId = useActiveThemeId();
  const setTheme = useThemeStore((state) => state.setTheme);

  // Store the original theme when dropdown opens for revert functionality
  const originalThemeRef = useRef<ThemeId>(activeThemeId);
  const [isOpen, setIsOpen] = useState(false);
  const [previewThemeId, setPreviewThemeId] = useState<ThemeId | null>(null);

  // Update original theme ref when dropdown opens
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        originalThemeRef.current = activeThemeId;
      } else {
        // If closing without explicit selection, revert to original
        if (previewThemeId && previewThemeId !== activeThemeId) {
          setTheme(originalThemeRef.current);
        }
        setPreviewThemeId(null);
      }
      setIsOpen(open);
    },
    [activeThemeId, previewThemeId, setTheme]
  );

  // Preview theme on hover
  const handleThemeHover = useCallback(
    (themeId: ThemeId) => {
      setPreviewThemeId(themeId);
      setTheme(themeId);
    },
    [setTheme]
  );

  // Apply theme on click
  const handleThemeSelect = useCallback(
    (themeId: ThemeId) => {
      setTheme(themeId);
      originalThemeRef.current = themeId; // Update original so close doesn't revert
      setPreviewThemeId(null);
      setIsOpen(false);
      onThemeChange?.(themeId);
    },
    [setTheme, onThemeChange]
  );

  // Handle keyboard escape to revert
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTheme(originalThemeRef.current);
        setPreviewThemeId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setTheme]);

  const defaultTrigger = (
    <button
      className="h-full px-3 hover:bg-muted transition-colors flex items-center justify-center gap-1.5"
      aria-label="Select theme"
      title={`Theme: ${THEMES[activeThemeId]?.name || activeThemeId}`}
    >
      <Palette className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>{trigger || defaultTrigger}</DropdownMenuTrigger>
      <DropdownMenuContent side={side} align={align} className="w-48">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Themes
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {THEME_ORDER.map((themeId) => {
          const theme = THEMES[themeId];
          const isActive = activeThemeId === themeId;
          const isPreview = previewThemeId === themeId;

          return (
            <DropdownMenuItem
              key={themeId}
              className={cn("flex items-center gap-3 cursor-pointer", isPreview && "bg-accent")}
              onMouseEnter={() => handleThemeHover(themeId)}
              onSelect={() => handleThemeSelect(themeId)}
            >
              {/* Theme swatch */}
              <ThemeSwatch theme={theme} size="md" />

              {/* Theme name and mode icon */}
              <div className="flex-1 flex items-center gap-2">
                <span className="text-sm">{theme.name}</span>
                {theme.mode === "light" ? (
                  <Sun className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <Moon className="h-3 w-3 text-muted-foreground" />
                )}
              </div>

              {/* Check mark for active theme */}
              {isActive && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { ThemeSwatch };
