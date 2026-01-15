/**
 * TabBar - Horizontal tab navigation for terminal tabs
 *
 * Story 3.1: Implement Tab Bar UI Component
 * Story 3.2: Open New Terminal Tabs
 * Story 3.3: Close Terminal Tabs
 * Story 3.4: Switch Between Terminal Tabs
 * Story 3.5: Reorder Tabs via Drag and Drop
 * v1.1: Tab rename, improved active tab styling
 * v1.2: Workspace moved to sidebar
 */

import { useState } from "react";
import { Plus, X, Terminal, ChevronDown, Check, GripVertical } from "lucide-react";
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
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { useSessionStore, useTabs, useActiveTabId } from "@/stores";
import type { TabState } from "@/stores";
import type { ShellType } from "@/types/terminal.types";
import { getShellDisplayName } from "@/types/terminal.types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Shell icon colors
 */
const shellColors: Record<ShellType, string> = {
  powershell: "text-blue-400",
  cmd: "text-yellow-400",
  wsl: "text-orange-400",
  gitbash: "text-red-400",
};

/**
 * Sortable tab item component with rename support
 */
function SortableTabItem({
  tab,
  isActive,
  onSelect,
  onClose,
  onRename,
}: {
  tab: TabState;
  isActive: boolean;
  onSelect: () => void;
  onClose: (e: React.MouseEvent) => void;
  onRename: (newTitle: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(tab.title);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(tab.title);
    setIsEditing(true);
  };

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== tab.title) {
      onRename(trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(tab.title);
      setIsEditing(false);
    }
  };

  const displayTitle = tab.isLoading
    ? "Loading..."
    : tab.hasExited
      ? `[exited] ${tab.title}`
      : tab.title;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-1 px-2 py-1.5 min-w-[120px] max-w-[200px]",
        "border-r border-border cursor-pointer transition-all duration-150",
        "hover:bg-muted/50",
        // Enhanced active tab styling
        isActive
          ? "bg-primary/10 border-b-2 border-b-primary shadow-[inset_0_1px_0_0_hsl(var(--primary)/0.2)]"
          : "border-b-2 border-b-transparent",
        // Dragging state
        isDragging && "opacity-50 z-50"
      )}
      onClick={onSelect}
      onDoubleClick={handleDoubleClick}
      title={isEditing ? undefined : `${tab.title}\nDouble-click to rename\nDrag to reorder`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          "flex items-center justify-center cursor-grab active:cursor-grabbing",
          "opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity",
          "-ml-1"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </div>

      {/* Shell indicator */}
      <Terminal
        className={cn(
          "h-3.5 w-3.5 flex-shrink-0 transition-transform",
          shellColors[tab.shellType],
          isActive && "scale-110"
        )}
      />

      {/* Tab title or edit input */}
      {isEditing ? (
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            autoFocus
            className={cn(
              "flex-1 min-w-0 h-5 px-1 text-sm rounded",
              "bg-background border border-border",
              "focus:outline-none focus:ring-1 focus:ring-ring"
            )}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSave();
            }}
            className="p-0.5 hover:bg-accent rounded"
          >
            <Check className="h-3 w-3 text-green-500" />
          </button>
        </div>
      ) : (
        <span
          className={cn(
            "flex-1 truncate text-sm transition-colors",
            isActive ? "text-foreground font-medium" : "text-muted-foreground"
          )}
        >
          {displayTitle}
        </span>
      )}

      {/* Close button */}
      {!isEditing && (
        <button
          className={cn(
            "h-4 w-4 flex items-center justify-center rounded-sm",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "hover:bg-destructive/20 hover:text-destructive"
          )}
          onClick={onClose}
          aria-label="Close tab"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/**
 * Drag overlay component (shows while dragging)
 */
function TabDragOverlay({ tab }: { tab: TabState | null }) {
  if (!tab) return null;

  const displayTitle = tab.isLoading
    ? "Loading..."
    : tab.hasExited
      ? `[exited] ${tab.title}`
      : tab.title;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 min-w-[120px] max-w-[200px]",
        "bg-primary/20 border border-primary rounded-md shadow-lg",
        "cursor-grabbing"
      )}
    >
      <Terminal className={cn("h-3.5 w-3.5 flex-shrink-0", shellColors[tab.shellType])} />
      <span className="flex-1 truncate text-sm font-medium text-foreground">{displayTitle}</span>
    </div>
  );
}

/**
 * New tab button with shell selector
 */
function NewTabButton({ onNewTab }: { onNewTab: (shellType: ShellType) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1 px-2 py-1.5",
            "hover:bg-muted/50 transition-colors rounded-sm",
            "text-muted-foreground hover:text-foreground"
          )}
          aria-label="New tab"
        >
          <Plus className="h-4 w-4" />
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-popover border-border">
        <DropdownMenuItem onClick={() => onNewTab("powershell")}>
          <Terminal className={cn("h-4 w-4 mr-2", shellColors.powershell)} />
          {getShellDisplayName("powershell")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onNewTab("cmd")}>
          <Terminal className={cn("h-4 w-4 mr-2", shellColors.cmd)} />
          {getShellDisplayName("cmd")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onNewTab("wsl")}>
          <Terminal className={cn("h-4 w-4 mr-2", shellColors.wsl)} />
          {getShellDisplayName("wsl")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onNewTab("gitbash")}>
          <Terminal className={cn("h-4 w-4 mr-2", shellColors.gitbash)} />
          {getShellDisplayName("gitbash")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface TabBarProps {
  /** Callback when a new tab is requested */
  onNewTab?: (shellType: ShellType) => void;
  /** Callback when a tab close is requested */
  onCloseTab?: (tabId: string) => void;
  /** Custom class name */
  className?: string;
}

export function TabBar({ onNewTab, onCloseTab, className }: TabBarProps) {
  const tabs = useTabs();
  const activeTabId = useActiveTabId();
  const { setActiveTab, removeTab, addTab, updateTab, reorderTabs } = useSessionStore();
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
      const oldIndex = tabs.findIndex((tab) => tab.id === active.id);
      const newIndex = tabs.findIndex((tab) => tab.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderTabs(oldIndex, newIndex);
      }
    }
  };

  const handleNewTab = (shellType: ShellType) => {
    addTab(shellType);
    onNewTab?.(shellType);
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    onCloseTab?.(tabId);
    removeTab(tabId);
  };

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
  };

  const handleRenameTab = (tabId: string, newTitle: string) => {
    // Set titleLocked to prevent shell from overwriting user-set title
    updateTab(tabId, { title: newTitle, titleLocked: true });
  };

  // Find the active tab for drag overlay
  const activeTab = activeId ? tabs.find((tab) => tab.id === activeId) : null;

  return (
    <div className={cn("h-9 flex items-stretch bg-background border-b border-border", className)}>
      {/* Tab list with drag and drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex items-stretch overflow-x-auto scrollbar-hide">
          <SortableContext
            items={tabs.map((tab) => tab.id)}
            strategy={horizontalListSortingStrategy}
          >
            {tabs.map((tab) => (
              <SortableTabItem
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onSelect={() => handleSelectTab(tab.id)}
                onClose={(e) => handleCloseTab(e, tab.id)}
                onRename={(newTitle) => handleRenameTab(tab.id, newTitle)}
              />
            ))}
          </SortableContext>
        </div>

        {/* Drag overlay - shows the tab being dragged */}
        <DragOverlay>
          <TabDragOverlay tab={activeTab ?? null} />
        </DragOverlay>
      </DndContext>

      {/* New tab button */}
      <div className="flex items-center px-1 border-l border-border">
        <NewTabButton onNewTab={handleNewTab} />
      </div>
    </div>
  );
}
