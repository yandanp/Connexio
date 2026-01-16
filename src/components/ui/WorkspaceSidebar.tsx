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
 * - Drag and drop reordering of workspaces
 */

import { useState, useRef, useEffect } from "react";
import { Plus, Settings2, Home, Check } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import {
  useSessionStore,
  useActiveWorkspaceId,
  WORKSPACE_COLORS,
  type WorkspaceColorId,
  type WorkspaceSession,
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

/**
 * Sortable workspace icon component
 */
function SortableWorkspaceIcon({
  workspace,
  isActive,
  onSelect,
}: {
  workspace: WorkspaceSession;
  isActive: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: workspace.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const initials = getWorkspaceInitials(workspace.name);
  const color = getWorkspaceColor(workspace.color, workspace.name);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={setNodeRef}
          style={style}
          onClick={onSelect}
          {...attributes}
          {...listeners}
          className={cn(
            "relative w-9 h-9 rounded-lg flex items-center justify-center",
            "text-xs font-bold text-white",
            "transition-all duration-150 cursor-grab active:cursor-grabbing",
            color.bg,
            isActive
              ? "ring-2 ring-white ring-offset-2 ring-offset-muted/50 scale-105"
              : "opacity-60 hover:opacity-100 hover:scale-105",
            isDragging && "opacity-50 z-50 shadow-lg"
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
        <p className="text-xs opacity-50">Drag to reorder</p>
        {isActive && <p className="text-xs text-green-400 font-medium">● Active</p>}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Drag overlay component for workspace (shows while dragging)
 */
function WorkspaceDragOverlay({ workspace }: { workspace: WorkspaceSession | null }) {
  if (!workspace) return null;

  const initials = getWorkspaceInitials(workspace.name);
  const color = getWorkspaceColor(workspace.color, workspace.name);

  return (
    <div
      className={cn(
        "relative w-9 h-9 rounded-lg flex items-center justify-center",
        "text-xs font-bold text-white",
        "ring-2 ring-primary shadow-xl scale-110",
        color.bg
      )}
    >
      {initials}
      <TabCountBadge count={workspace.tabs.length} />
    </div>
  );
}

interface WorkspaceSidebarProps {
  className?: string;
}

export function WorkspaceSidebar({ className }: WorkspaceSidebarProps) {
  // Use raw workspaces array (not sorted hook) for proper drag ordering
  const workspaces = useSessionStore((state) => state.workspaces);
  const activeWorkspaceId = useActiveWorkspaceId();
  const defaultSession = useSessionStore((state) => state.defaultSession);
  const { switchWorkspace, createWorkspace, reorderWorkspaces } = useSessionStore();

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);

  // Configure sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = workspaces.findIndex((ws) => ws.id === active.id);
      const newIndex = workspaces.findIndex((ws) => ws.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderWorkspaces(oldIndex, newIndex);
      }
    }
  };

  // Find active workspace for drag overlay
  const activeWorkspace = activeId ? workspaces.find((ws) => ws.id === activeId) : null;

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

        {/* Workspace Icons with Drag and Drop */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 flex flex-col items-center gap-1.5 overflow-y-auto scrollbar-hide w-full px-1">
            <SortableContext
              items={workspaces.map((ws) => ws.id)}
              strategy={verticalListSortingStrategy}
            >
              {workspaces.map((workspace) => (
                <SortableWorkspaceIcon
                  key={workspace.id}
                  workspace={workspace}
                  isActive={workspace.id === activeWorkspaceId}
                  onSelect={() => handleSwitchWorkspace(workspace.id)}
                />
              ))}
            </SortableContext>
          </div>

          {/* Drag overlay - shows the workspace being dragged */}
          <DragOverlay>
            <WorkspaceDragOverlay workspace={activeWorkspace ?? null} />
          </DragOverlay>
        </DndContext>

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
