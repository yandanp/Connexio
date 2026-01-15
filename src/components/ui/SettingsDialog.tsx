/**
 * SettingsDialog - Application settings panel
 *
 * Story 5.5: Build Settings Panel UI
 * Story 5.6: Implement Shell Settings
 * Story 5.7: Implement Theme Settings
 * v1.1: Added Workspaces management section
 *
 * Features:
 * - Tabbed sections for organization
 * - Immediate effect changes (no save button)
 * - Keyboard shortcut support (Ctrl+,)
 */

import { useState } from "react";
import {
  Settings,
  Palette,
  Terminal,
  Monitor,
  Briefcase,
  Check,
  Sun,
  Moon,
  Trash2,
  FolderOpen,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ThemeSwatch } from "@/components/ui/ThemePicker";
import {
  useSettingsStore,
  useThemeStore,
  useActiveThemeId,
  useWorkspaces,
  useActiveWorkspaceId,
  useSessionStore,
} from "@/stores";
import { THEMES, THEME_ORDER } from "@/lib/themes";
import { getShellDisplayName } from "@/types/terminal.types";
import type { ShellType } from "@/types";
import { cn } from "@/lib/utils";

type SettingsTab = "appearance" | "shell" | "general" | "workspaces";

const AVAILABLE_SHELLS: ShellType[] = ["powershell", "cmd", "wsl", "gitbash"];

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCheckUpdates?: () => void;
}

/**
 * Section header component
 */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-medium text-foreground mb-3">{children}</h3>;
}

/**
 * Settings row component for consistent layout
 */
function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <div className="flex-1 mr-4">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description && <div className="text-xs text-muted-foreground mt-0.5">{description}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

/**
 * Toggle switch component
 */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-background transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

/**
 * Select dropdown component
 */
function Select<T extends string>({
  value,
  options,
  onChange,
  getLabel,
}: {
  value: T;
  options: T[];
  onChange: (value: T) => void;
  getLabel?: (value: T) => string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn(
        "h-8 px-3 rounded-md border border-border bg-background text-sm",
        "focus:outline-none focus:ring-2 focus:ring-ring"
      )}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {getLabel ? getLabel(option) : option}
        </option>
      ))}
    </select>
  );
}

/**
 * Slider component for numeric values
 */
function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
      />
      <span className="text-sm text-muted-foreground w-8 text-right">{value}px</span>
    </div>
  );
}

/**
 * Appearance settings section
 */
function AppearanceSection() {
  const activeThemeId = useActiveThemeId();
  const setTheme = useThemeStore((state) => state.setTheme);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const setSetting = useSettingsStore((state) => state.setSetting);

  return (
    <div className="space-y-4">
      <SectionHeader>Font</SectionHeader>
      <SettingRow label="Terminal font size" description="Size of text in the terminal (10-24px)">
        <Slider
          value={fontSize}
          min={10}
          max={24}
          onChange={(value) => setSetting("fontSize", value)}
        />
      </SettingRow>

      <SectionHeader>Theme</SectionHeader>
      <div className="grid grid-cols-1 gap-2">
        {THEME_ORDER.map((themeId) => {
          const theme = THEMES[themeId];
          const isActive = activeThemeId === themeId;

          return (
            <button
              key={themeId}
              onClick={() => setTheme(themeId)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                isActive
                  ? "border-primary bg-accent"
                  : "border-border hover:border-primary/50 hover:bg-accent/50"
              )}
            >
              <ThemeSwatch theme={theme} size="md" />
              <div className="flex-1 flex items-center gap-2 text-left">
                <span className="text-sm font-medium">{theme.name}</span>
                {theme.mode === "light" ? (
                  <Sun className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <Moon className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
              {isActive && <Check className="h-4 w-4 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Shell settings section
 */
function ShellSection() {
  const defaultShell = useSettingsStore((state) => state.defaultShell);
  const setSetting = useSettingsStore((state) => state.setSetting);

  return (
    <div className="space-y-1">
      <SectionHeader>Default Shell</SectionHeader>
      <SettingRow
        label="Default shell for new tabs"
        description="The shell that opens when you create a new tab"
      >
        <Select
          value={defaultShell}
          options={AVAILABLE_SHELLS}
          onChange={(value) => setSetting("defaultShell", value)}
          getLabel={getShellDisplayName}
        />
      </SettingRow>
    </div>
  );
}

/**
 * General settings section
 */
function GeneralSection({ onCheckUpdates }: { onCheckUpdates?: () => void }) {
  const restoreSession = useSettingsStore((state) => state.restoreSession);
  const lastTabBehavior = useSettingsStore((state) => state.lastTabBehavior);
  const setSetting = useSettingsStore((state) => state.setSetting);

  return (
    <div className="space-y-1">
      <SectionHeader>Session</SectionHeader>
      <SettingRow
        label="Restore session on startup"
        description="Reopen tabs from your previous session"
      >
        <Toggle
          checked={restoreSession}
          onChange={(checked) => setSetting("restoreSession", checked)}
        />
      </SettingRow>

      <SectionHeader>Tabs</SectionHeader>
      <SettingRow
        label="When closing last tab"
        description="What happens when you close the last open tab"
      >
        <Select
          value={lastTabBehavior}
          options={["close", "new"] as const}
          onChange={(value) => setSetting("lastTabBehavior", value)}
          getLabel={(v) => (v === "close" ? "Close window" : "Open new tab")}
        />
      </SettingRow>

      <SectionHeader>Updates</SectionHeader>
      <SettingRow label="Check for updates" description="See if a newer version is available">
        <Button variant="outline" size="sm" className="gap-2" onClick={onCheckUpdates}>
          <RefreshCw className="h-3.5 w-3.5" />
          Check Now
        </Button>
      </SettingRow>
    </div>
  );
}

/**
 * Format date for display
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Workspaces settings section
 */
function WorkspacesSection() {
  const workspaces = useWorkspaces();
  const activeWorkspaceId = useActiveWorkspaceId();
  const { switchWorkspace, deleteWorkspace } = useSessionStore();

  return (
    <div className="space-y-4">
      <SectionHeader>Saved Workspaces</SectionHeader>

      {workspaces.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground border border-dashed border-border rounded-lg">
          <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No saved workspaces</p>
          <p className="text-xs mt-1">
            Use the workspace switcher in the title bar to save your current session
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {workspaces.map((workspace) => {
            const isActive = workspace.id === activeWorkspaceId;
            return (
              <div
                key={workspace.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  isActive ? "border-primary bg-accent/50" : "border-border"
                )}
              >
                <FolderOpen className={cn("h-4 w-4", isActive && "text-primary")} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{workspace.name}</span>
                    {isActive && (
                      <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {workspace.tabs.length} tab{workspace.tabs.length !== 1 ? "s" : ""} ·{" "}
                    {formatDate(workspace.updatedAt)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => switchWorkspace(workspace.id)}
                    disabled={isActive}
                  >
                    Load
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => deleteWorkspace(workspace.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Settings dialog component
 */
export function SettingsDialog({ open, onOpenChange, onCheckUpdates }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "appearance", label: "Appearance", icon: <Palette className="h-4 w-4" /> },
    { id: "shell", label: "Shell", icon: <Terminal className="h-4 w-4" /> },
    { id: "workspaces", label: "Workspaces", icon: <Briefcase className="h-4 w-4" /> },
    { id: "general", label: "General", icon: <Monitor className="h-4 w-4" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </DialogTitle>
          <DialogDescription>Configure your terminal preferences</DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 flex-1 overflow-hidden mt-4">
          {/* Tab navigation */}
          <div className="flex flex-col gap-1 w-32 flex-shrink-0">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "secondary" : "ghost"}
                size="sm"
                className="justify-start gap-2"
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto pr-2">
            {activeTab === "appearance" && <AppearanceSection />}
            {activeTab === "shell" && <ShellSection />}
            {activeTab === "workspaces" && <WorkspacesSection />}
            {activeTab === "general" && <GeneralSection onCheckUpdates={onCheckUpdates} />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
