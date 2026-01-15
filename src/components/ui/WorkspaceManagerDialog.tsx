/**
 * WorkspaceManagerDialog - Full CRUD management for workspaces
 *
 * Named Workspaces feature (v1.2 - Session-based)
 *
 * Features:
 * - List all workspaces
 * - Rename, change color, duplicate, delete workspaces
 * - Switch to workspace
 * - View workspace details
 */

import { useState } from "react";
import { Settings2, Pencil, Trash2, Copy, FolderOpen, Terminal, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  useSessionStore,
  useWorkspaces,
  useActiveWorkspaceId,
  WORKSPACE_COLORS,
  type WorkspaceColorId,
} from "@/stores";
import type { WorkspaceSession } from "@/stores";
import { getShellDisplayName } from "@/types/terminal.types";
import { cn } from "@/lib/utils";

interface WorkspaceManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Format date for display
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get workspace color by ID or generate from name (fallback)
 */
function getWorkspaceColor(
  colorId: WorkspaceColorId | undefined,
  name: string
): (typeof WORKSPACE_COLORS)[number] {
  if (colorId) {
    const found = WORKSPACE_COLORS.find((c) => c.id === colorId);
    if (found) return found;
  }
  // Fallback: hash-based color
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return WORKSPACE_COLORS[Math.abs(hash) % WORKSPACE_COLORS.length];
}

/**
 * Color picker popover for workspace
 */
function ColorPickerPopover({
  currentColor,
  workspaceName,
  onColorChange,
}: {
  currentColor: WorkspaceColorId | undefined;
  workspaceName: string;
  onColorChange: (color: WorkspaceColorId) => void;
}) {
  const [open, setOpen] = useState(false);
  const color = getWorkspaceColor(currentColor, workspaceName);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title="Change color"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={cn("w-4 h-4 rounded", color.bg)} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" onClick={(e) => e.stopPropagation()}>
        <div className="grid grid-cols-5 gap-1.5">
          {WORKSPACE_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onColorChange(c.id);
                setOpen(false);
              }}
              className={cn(
                "w-7 h-7 rounded-md transition-all",
                c.bg,
                "hover:scale-110 hover:ring-2 hover:ring-white/50",
                currentColor === c.id && "ring-2 ring-white ring-offset-1 ring-offset-background"
              )}
            >
              {currentColor === c.id && (
                <Check className="w-3.5 h-3.5 mx-auto text-white drop-shadow-md" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Single workspace row component
 */
function WorkspaceRow({
  workspace,
  isActive,
  onSwitch,
  onRename,
  onColorChange,
  onDuplicate,
  onDelete,
}: {
  workspace: WorkspaceSession;
  isActive: boolean;
  onSwitch: () => void;
  onRename: (name: string) => void;
  onColorChange: (color: WorkspaceColorId) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(workspace.name);
  const [isExpanded, setIsExpanded] = useState(false);

  const color = getWorkspaceColor(workspace.color, workspace.name);

  const handleSaveEdit = () => {
    if (editName.trim() && editName.trim() !== workspace.name) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(workspace.name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSaveEdit();
    if (e.key === "Escape") handleCancelEdit();
  };

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        isActive ? "border-primary bg-accent/50" : "border-border hover:border-primary/30"
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 p-3">
        <button
          className="flex-1 flex items-center gap-3 text-left min-w-0"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {/* Color indicator */}
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
              "text-xs font-bold text-white",
              color.bg
            )}
          >
            {workspace.name.slice(0, 2).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSaveEdit}
                  autoFocus
                  className="flex-1 h-7 px-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveEdit();
                  }}
                  className="p-1 hover:bg-accent rounded"
                >
                  <Check className="h-3.5 w-3.5 text-green-600" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelEdit();
                  }}
                  className="p-1 hover:bg-accent rounded"
                >
                  <X className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{workspace.name}</span>
                  {isActive && (
                    <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      Active
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {workspace.tabs.length} tab{workspace.tabs.length !== 1 ? "s" : ""} · Updated{" "}
                  {formatDate(workspace.updatedAt)}
                </div>
              </>
            )}
          </div>
        </button>

        {/* Actions */}
        {!isEditing && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <ColorPickerPopover
              currentColor={workspace.color}
              workspaceName={workspace.name}
              onColorChange={onColorChange}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onSwitch();
              }}
              title="Switch to workspace"
            >
              <FolderOpen className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
                setEditName(workspace.name);
                setIsEditing(true);
              }}
              title="Rename"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              title="Duplicate"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Expanded details */}
      {isExpanded && !isEditing && (
        <div className="border-t border-border px-3 py-2 bg-muted/30">
          <div className="text-xs text-muted-foreground mb-2">Tabs:</div>
          {workspace.tabs.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No tabs</p>
          ) : (
            <ul className="space-y-1">
              {workspace.tabs.map((tab) => (
                <li key={tab.id} className="flex items-center gap-2 text-sm">
                  <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">
                    {tab.title || getShellDisplayName(tab.shellType)}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {getShellDisplayName(tab.shellType)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 text-xs text-muted-foreground">
            Created: {formatDate(workspace.createdAt)}
          </div>
        </div>
      )}
    </div>
  );
}

export function WorkspaceManagerDialog({ open, onOpenChange }: WorkspaceManagerDialogProps) {
  const workspaces = useWorkspaces();
  const activeWorkspaceId = useActiveWorkspaceId();
  const {
    switchWorkspace,
    renameWorkspace,
    setWorkspaceColor,
    duplicateWorkspace,
    deleteWorkspace,
  } = useSessionStore();

  const handleSwitch = (id: string) => {
    switchWorkspace(id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Manage Workspaces
          </DialogTitle>
          <DialogDescription>View, edit, and organize your workspaces.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-2">
          {workspaces.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No workspaces yet.</p>
              <p className="text-xs mt-1">Click the green + button in the sidebar to create one.</p>
            </div>
          ) : (
            workspaces.map((workspace) => (
              <WorkspaceRow
                key={workspace.id}
                workspace={workspace}
                isActive={workspace.id === activeWorkspaceId}
                onSwitch={() => handleSwitch(workspace.id)}
                onRename={(name) => renameWorkspace(workspace.id, name)}
                onColorChange={(color) => setWorkspaceColor(workspace.id, color)}
                onDuplicate={() => duplicateWorkspace(workspace.id)}
                onDelete={() => deleteWorkspace(workspace.id)}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
