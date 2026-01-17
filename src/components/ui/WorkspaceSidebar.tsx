/**
 * WorkspaceSidebar - Expandable workspace switcher
 *
 * Named Workspaces feature (v1.2 - Session-based)
 *
 * Features:
 * - Collapsible sidebar (48px collapsed, 200px expanded)
 * - Hover to expand, click pin to keep expanded
 * - Visual workspace icons with full names when expanded
 * - Custom color selection for workspaces
 * - Active workspace highlighted
 * - Quick switch with single click (preserves terminal state!)
 * - Create new workspace via popover with color picker
 * - Manage workspaces button
 * - Drag and drop reordering of workspaces
 */

import { useState, useRef, useEffect } from "react";
import { Plus, Settings2, Home, Check, PanelLeftClose, PanelLeft } from "lucide-react";
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
import {
  getWorkspaceColor,
  getWorkspaceInitials,
  MAX_WORKSPACE_NAME_LENGTH,
  DRAG_ACTIVATION_DISTANCE,
} from "@/lib/workspace-utils";

// =============================================================================
// CONSTANTS
// =============================================================================

const SIDEBAR_COLLAPSED_WIDTH = 56; // px
const SIDEBAR_EXPANDED_WIDTH = 200; // px
const HOVER_EXPAND_DELAY = 300; // ms delay before expanding on hover

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Tab count badge component - adapts to collapsed/expanded state
 */
function TabCountBadge({ count, expanded }: { count: number; expanded: boolean }) {
  if (count === 0) return null;

  if (expanded) {
    return <span className="text-xs text-muted-foreground tabular-nums">{count}</span>;
  }

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
 * Sortable workspace item component - adapts to collapsed/expanded state
 */
function SortableWorkspaceIcon({
  workspace,
  isActive,
  isExpanded,
  onSelect,
}: {
  workspace: WorkspaceSession;
  isActive: boolean;
  isExpanded: boolean;
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

  // Expanded state - show full name
  if (isExpanded) {
    return (
      <button
        ref={setNodeRef}
        style={style}
        onClick={onSelect}
        {...attributes}
        {...listeners}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg",
          "transition-all duration-150 cursor-grab active:cursor-grabbing",
          "text-left",
          isActive
            ? "bg-primary/10 border border-primary/30"
            : "hover:bg-accent border border-transparent",
          isDragging && "opacity-50 z-50 shadow-lg"
        )}
      >
        {/* Color indicator */}
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
            "text-xs font-bold text-white",
            color.bg
          )}
        >
          {initials}
        </div>

        {/* Name and tab count */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm truncate">{workspace.name}</span>
            <TabCountBadge count={workspace.tabs.length} expanded />
          </div>
          {isActive && <span className="text-xs text-primary">● Active</span>}
        </div>
      </button>
    );
  }

  // Collapsed state - show icon only with tooltip
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
            "relative w-10 h-10 rounded-lg flex items-center justify-center",
            "text-xs font-bold text-white",
            "transition-all duration-150 cursor-grab active:cursor-grabbing",
            color.bg,
            isActive
              ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105"
              : "opacity-70 hover:opacity-100 hover:scale-105",
            isDragging && "opacity-50 z-50 shadow-lg"
          )}
        >
          {initials}
          <TabCountBadge count={workspace.tabs.length} expanded={false} />
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
}

/**
 * Drag overlay component for workspace (shows while dragging)
 */
function WorkspaceDragOverlay({
  workspace,
  isExpanded,
}: {
  workspace: WorkspaceSession | null;
  isExpanded: boolean;
}) {
  if (!workspace) return null;

  const initials = getWorkspaceInitials(workspace.name);
  const color = getWorkspaceColor(workspace.color, workspace.name);

  if (isExpanded) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg",
          "bg-background border-2 border-primary shadow-xl"
        )}
      >
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
            "text-xs font-bold text-white",
            color.bg
          )}
        >
          {initials}
        </div>
        <span className="font-medium text-sm">{workspace.name}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative w-10 h-10 rounded-lg flex items-center justify-center",
        "text-xs font-bold text-white",
        "ring-2 ring-primary shadow-xl scale-110",
        color.bg
      )}
    >
      {initials}
      <TabCountBadge count={workspace.tabs.length} expanded={false} />
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface WorkspaceSidebarProps {
  className?: string;
}

export function WorkspaceSidebar({ className }: WorkspaceSidebarProps) {
  // Use raw workspaces array (not sorted hook) for proper drag ordering
  const workspaces = useSessionStore((state) => state.workspaces);
  const activeWorkspaceId = useActiveWorkspaceId();
  const defaultSession = useSessionStore((state) => state.defaultSession);
  const { switchWorkspace, createWorkspace, reorderWorkspaces } = useSessionStore();

  // Sidebar expansion state
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);

  // Configure sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: DRAG_ACTIVATION_DISTANCE,
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

  // Handle hover expand/collapse
  const handleMouseEnter = () => {
    if (isPinned) return;
    hoverTimeoutRef.current = setTimeout(() => {
      setIsExpanded(true);
    }, HOVER_EXPAND_DELAY);
  };

  const handleMouseLeave = () => {
    if (isPinned) return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsExpanded(false);
  };

  // Toggle pin state
  const togglePin = () => {
    setIsPinned(!isPinned);
    if (!isPinned) {
      setIsExpanded(true);
    }
  };

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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

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

  const currentWidth = isExpanded || isPinned ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH;

  return (
    <TooltipProvider delayDuration={100}>
      <div
        ref={sidebarRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ width: currentWidth }}
        className={cn(
          "flex flex-col py-2",
          "bg-muted/50 border-r border-border",
          "transition-all duration-200 ease-in-out",
          className
        )}
      >
        {/* Header with pin toggle */}
        {(isExpanded || isPinned) && (
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Workspaces
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={togglePin}
                  className={cn(
                    "p-1 rounded hover:bg-accent transition-colors",
                    isPinned ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {isPinned ? (
                    <PanelLeftClose className="h-4 w-4" />
                  ) : (
                    <PanelLeft className="h-4 w-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isPinned ? "Unpin sidebar" : "Pin sidebar open"}
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Default Session (Home) */}
        <div className={cn("px-2", isExpanded || isPinned ? "px-2" : "flex justify-center")}>
          {isExpanded || isPinned ? (
            <button
              onClick={() => handleSwitchWorkspace(null)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg",
                "transition-all duration-150",
                "text-left",
                activeWorkspaceId === null
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-accent border border-transparent"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  activeWorkspaceId === null
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Home className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">Default</span>
                  <TabCountBadge count={defaultSession.tabs.length} expanded />
                </div>
                {activeWorkspaceId === null && (
                  <span className="text-xs text-primary">● Active</span>
                )}
              </div>
            </button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleSwitchWorkspace(null)}
                  className={cn(
                    "relative w-10 h-10 rounded-lg flex items-center justify-center",
                    "transition-all duration-150",
                    activeWorkspaceId === null
                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Home className="h-4 w-4" />
                  <TabCountBadge count={defaultSession.tabs.length} expanded={false} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                <p className="font-semibold">Default Session</p>
                <p className="text-xs opacity-70">
                  {defaultSession.tabs.length} tab{defaultSession.tabs.length !== 1 ? "s" : ""}
                </p>
                {activeWorkspaceId === null && (
                  <p className="text-xs text-green-400 font-medium">● Active</p>
                )}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Divider */}
        {workspaces.length > 0 && (
          <div className={cn("my-2", isExpanded || isPinned ? "mx-3" : "mx-auto w-6")}>
            <div className="h-px bg-border" />
          </div>
        )}

        {/* Workspace Icons with Drag and Drop */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            className={cn(
              "flex-1 flex flex-col gap-1 overflow-y-auto scrollbar-hide",
              isExpanded || isPinned ? "px-2" : "items-center px-2"
            )}
          >
            <SortableContext
              items={workspaces.map((ws) => ws.id)}
              strategy={verticalListSortingStrategy}
            >
              {workspaces.map((workspace) => (
                <SortableWorkspaceIcon
                  key={workspace.id}
                  workspace={workspace}
                  isActive={workspace.id === activeWorkspaceId}
                  isExpanded={isExpanded || isPinned}
                  onSelect={() => handleSwitchWorkspace(workspace.id)}
                />
              ))}
            </SortableContext>
          </div>

          {/* Drag overlay - shows the workspace being dragged */}
          <DragOverlay>
            <WorkspaceDragOverlay
              workspace={activeWorkspace ?? null}
              isExpanded={isExpanded || isPinned}
            />
          </DragOverlay>
        </DndContext>

        {/* Bottom Actions */}
        <div
          className={cn(
            "flex flex-col gap-1 mt-auto pt-2 border-t border-border",
            isExpanded || isPinned ? "px-2" : "items-center px-2"
          )}
        >
          {/* Create Workspace Button with Popover */}
          <Popover open={createPopoverOpen} onOpenChange={setCreatePopoverOpen}>
            {isExpanded || isPinned ? (
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg",
                    "bg-green-600 hover:bg-green-500 text-white",
                    "transition-all duration-150"
                  )}
                >
                  <Plus className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm font-medium">New Workspace</span>
                </button>
              </PopoverTrigger>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
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
                  </TooltipContent>
                )}
              </Tooltip>
            )}

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
                  maxLength={MAX_WORKSPACE_NAME_LENGTH}
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
            <>
              {isExpanded || isPinned ? (
                <button
                  onClick={() => setManageDialogOpen(true)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg",
                    "text-muted-foreground hover:text-foreground hover:bg-accent",
                    "transition-all duration-150"
                  )}
                >
                  <Settings2 className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">Manage</span>
                </button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setManageDialogOpen(true)}
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        "text-muted-foreground hover:text-foreground",
                        "hover:bg-accent transition-all duration-150"
                      )}
                    >
                      <Settings2 className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    <p className="font-semibold">Manage Workspaces</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          )}
        </div>

        {/* Dialogs */}
        <WorkspaceManagerDialog open={manageDialogOpen} onOpenChange={setManageDialogOpen} />
      </div>
    </TooltipProvider>
  );
}
