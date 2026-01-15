/**
 * WorkspaceSidebar - Icon Rail style workspace switcher
 *
 * Named Workspaces feature (v1.2 - Session-based)
 *
 * Features:
 * - Compact icon rail (48px width)
 * - Visual workspace icons with initials + tab count badge
 * - Custom color selection for workspaces
 * - Tooltip on hover with workspace name
 * - Active workspace highlighted
 * - Quick switch with single click (preserves terminal state!)
 * - Create new workspace via popover with color picker
 * - Manage workspaces button
 */

import { useState, useRef, useEffect } from "react";
import { Plus, Settings2, Home, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSessionStore,
  useWorkspaces,
  useActiveWorkspaceId,
  WORKSPACE_COLORS,
  type WorkspaceColorId,
} from "@/stores";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WorkspaceManagerDialog } from "@/components/ui";

/**
 * Get initials from workspace name (max 2 chars)
 */
function getWorkspaceInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Generate a consistent color based on workspace name (fallback)
 */
function getWorkspaceColorFallback(name: string): (typeof WORKSPACE_COLORS)[number] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return WORKSPACE_COLORS[Math.abs(hash) % WORKSPACE_COLORS.length];
}

/**
 * Get workspace color by ID or generate from name
 */
function getWorkspaceColor(
  colorId: WorkspaceColorId | undefined,
  name: string
): (typeof WORKSPACE_COLORS)[number] {
  if (colorId) {
    const found = WORKSPACE_COLORS.find((c) => c.id === colorId);
    if (found) return found;
  }
  return getWorkspaceColorFallback(name);
}

/**
 * Tab count badge component
 */
function TabCountBadge({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <span
      className={cn(
        "absolute -bottom-0.5 -right-0.5",
        "min-w-[14px] h-[14px] px-[3px]",
        "flex items-center justify-center",
        "text-[9px] font-bold leading-none",
        "bg-zinc-800 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900",
        "rounded-full border border-background"
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/**
 * Color picker grid component
 */
function ColorPicker({
  selected,
  onChange,
}: {
  selected: WorkspaceColorId | undefined;
  onChange: (color: WorkspaceColorId) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {WORKSPACE_COLORS.map((color) => (
        <button
          key={color.id}
          type="button"
          onClick={() => onChange(color.id)}
          className={cn(
            "w-7 h-7 rounded-md transition-all",
            color.bg,
            "hover:scale-110 hover:ring-2 hover:ring-white/50",
            selected === color.id && "ring-2 ring-white ring-offset-1 ring-offset-background"
          )}
        >
          {selected === color.id && (
            <Check className="w-3.5 h-3.5 mx-auto text-white drop-shadow-md" />
          )}
        </button>
      ))}
    </div>
  );
}

interface WorkspaceSidebarProps {
  className?: string;
}

export function WorkspaceSidebar({ className }: WorkspaceSidebarProps) {
  const workspaces = useWorkspaces();
  const activeWorkspaceId = useActiveWorkspaceId();
  const defaultSession = useSessionStore((state) => state.defaultSession);
  const { switchWorkspace, createWorkspace } = useSessionStore();

  // Dialog states
  const [manageDialogOpen, setManageDialogOpen] = useState(false);

  // Popover create state
  const [createPopoverOpen, setCreatePopoverOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<WorkspaceColorId>("blue");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when popover opens
  useEffect(() => {
    if (createPopoverOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [createPopoverOpen]);

  // Reset form when popover closes
  useEffect(() => {
    if (!createPopoverOpen) {
      setNewName("");
      setNewColor("blue");
    }
  }, [createPopoverOpen]);

  const handleSwitchWorkspace = (workspaceId: string | null) => {
    switchWorkspace(workspaceId);
  };

  const handleCreateWorkspace = () => {
    if (newName.trim()) {
      createWorkspace(newName.trim(), newColor);
      setCreatePopoverOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newName.trim()) {
      handleCreateWorkspace();
    } else if (e.key === "Escape") {
      setCreatePopoverOpen(false);
    }
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div
        className={cn(
          "w-12 flex flex-col items-center py-2 gap-1.5",
          "bg-muted/50 border-r border-border",
          className
        )}
      >
        {/* Header label */}
        <div className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
          WS
        </div>

        {/* Default Session (Home) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleSwitchWorkspace(null)}
              className={cn(
                "relative w-9 h-9 rounded-lg flex items-center justify-center",
                "transition-all duration-150",
                activeWorkspaceId === null
                  ? "bg-primary text-primary-foreground ring-2 ring-white ring-offset-2 ring-offset-muted/50"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Home className="h-4 w-4" />
              <TabCountBadge count={defaultSession.tabs.length} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            <p className="font-semibold">Default Session</p>
            <p className="text-xs opacity-70">
              {defaultSession.tabs.length} tab{defaultSession.tabs.length !== 1 ? "s" : ""} ·
              Unsaved
            </p>
            {activeWorkspaceId === null && (
              <p className="text-xs text-green-400 font-medium">● Active</p>
            )}
          </TooltipContent>
        </Tooltip>

        {/* Divider */}
        {workspaces.length > 0 && <div className="w-6 h-px bg-border my-1" />}

        {/* Workspace Icons */}
        <div className="flex-1 flex flex-col items-center gap-1.5 overflow-y-auto scrollbar-hide w-full px-1">
          {workspaces.map((workspace) => {
            const isActive = workspace.id === activeWorkspaceId;
            const initials = getWorkspaceInitials(workspace.name);
            const color = getWorkspaceColor(workspace.color, workspace.name);

            return (
              <Tooltip key={workspace.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleSwitchWorkspace(workspace.id)}
                    className={cn(
                      "relative w-9 h-9 rounded-lg flex items-center justify-center",
                      "text-xs font-bold text-white",
                      "transition-all duration-150",
                      color.bg,
                      isActive
                        ? "ring-2 ring-white ring-offset-2 ring-offset-muted/50 scale-105"
                        : "opacity-60 hover:opacity-100 hover:scale-105"
                    )}
                  >
                    {initials}
                    <TabCountBadge count={workspace.tabs.length} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p className="font-semibold">{workspace.name}</p>
                  <p className="text-xs opacity-70">
                    {workspace.tabs.length} tab{workspace.tabs.length !== 1 ? "s" : ""}
                  </p>
                  {isActive && <p className="text-xs text-green-400 font-medium">● Active</p>}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col items-center gap-1.5 mt-auto pt-2 border-t border-border w-full px-1">
          {/* Create Workspace Button with Popover */}
          <Popover open={createPopoverOpen} onOpenChange={setCreatePopoverOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center",
                      "bg-green-600 hover:bg-green-500 text-white",
                      "transition-all duration-150 hover:scale-105"
                    )}
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              {!createPopoverOpen && (
                <TooltipContent side="right" sideOffset={8}>
                  <p className="font-semibold">New Workspace</p>
                  <p className="text-xs opacity-70">Create fresh workspace with 1 tab</p>
                </TooltipContent>
              )}
            </Tooltip>

            <PopoverContent side="right" align="end" className="w-64 p-3">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h4 className="font-medium text-sm">New Workspace</h4>
                  <p className="text-xs text-muted-foreground">Enter a name and pick a color</p>
                </div>

                {/* Name input */}
                <input
                  ref={inputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., Project Alpha"
                  className={cn(
                    "w-full h-9 px-3 text-sm rounded-md",
                    "bg-background border border-input",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                    "placeholder:text-muted-foreground"
                  )}
                />

                {/* Color picker */}
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Color</label>
                  <ColorPicker selected={newColor} onChange={setNewColor} />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setCreatePopoverOpen(false)}
                    className={cn(
                      "flex-1 h-8 text-sm rounded-md",
                      "border border-input hover:bg-accent",
                      "transition-colors"
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateWorkspace}
                    disabled={!newName.trim()}
                    className={cn(
                      "flex-1 h-8 text-sm rounded-md font-medium",
                      "bg-primary text-primary-foreground",
                      "hover:bg-primary/90 transition-colors",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    Create
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Manage Workspaces Button */}
          {workspaces.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setManageDialogOpen(true)}
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center",
                    "text-muted-foreground hover:text-foreground",
                    "hover:bg-accent transition-all duration-150"
                  )}
                >
                  <Settings2 className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                <p className="font-semibold">Manage Workspaces</p>
                <p className="text-xs opacity-70">Rename, delete, organize</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Dialogs */}
        <WorkspaceManagerDialog open={manageDialogOpen} onOpenChange={setManageDialogOpen} />
      </div>
    </TooltipProvider>
  );
}
