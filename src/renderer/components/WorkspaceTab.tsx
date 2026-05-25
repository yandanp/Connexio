import { GripVertical, Pencil, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface TabProps {
	id: string;
	label: string;
	isActive: boolean;
	index: number;
	canClose: boolean;
	isDirty?: boolean;
	tabType?: "terminal" | "editor" | "preview";
	onSelect: () => void;
	onClose: () => void;
	onRename: (newLabel: string) => void;
	onDragStart: (index: number) => void;
	onDragOver: (index: number) => void;
	onDragEnd: () => void;
	onDrop: () => void;
	isDragOver: boolean;
	dragSide: "left" | "right" | null;
	isDragging: boolean;
}

export default function WorkspaceTab({
	id,
	label,
	isActive,
	index,
	canClose,
	isDirty,
	tabType,
	onSelect,
	onClose,
	onRename,
	onDragStart,
	onDragOver,
	onDragEnd,
	onDrop,
	isDragOver,
	dragSide,
	isDragging,
}: TabProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState(label);
	const inputRef = useRef<HTMLInputElement>(null);
	const tabRef = useRef<HTMLDivElement>(null);

	// Context menu state
	const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

	// Focus input when entering edit mode
	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [isEditing]);

	// Close context menu on outside click
	useEffect(() => {
		if (!contextMenu) return;
		const handleClick = (e: MouseEvent) => {
			// Don't close if clicking inside the context menu
			const target = e.target as HTMLElement;
			if (target.closest("[data-tab-context-menu]")) return;
			setContextMenu(null);
		};
		// Use setTimeout to avoid the same click that opened the menu from closing it
		const timer = setTimeout(() => {
			document.addEventListener("mousedown", handleClick);
		}, 0);
		return () => {
			clearTimeout(timer);
			document.removeEventListener("mousedown", handleClick);
		};
	}, [contextMenu]);

	const handleContextMenu = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setContextMenu({ x: e.clientX, y: e.clientY });
	}, []);

	const commitRename = () => {
		const trimmed = editValue.trim();
		if (trimmed && trimmed !== label) {
			onRename(trimmed);
		} else {
			setEditValue(label);
		}
		setIsEditing(false);
	};

	const cancelRename = () => {
		setEditValue(label);
		setIsEditing(false);
	};

	const handleDoubleClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setEditValue(label);
		setIsEditing(true);
	};

	const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		e.stopPropagation();
		if (e.key === "Enter") {
			e.preventDefault();
			commitRename();
		} else if (e.key === "Escape") {
			e.preventDefault();
			cancelRename();
		}
	};

	// Drag indicator styles
	const dragIndicatorClass = isDragOver
		? dragSide === "left"
			? "before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-connexio-accent before:rounded-full"
			: "after:absolute after:right-0 after:top-1 after:bottom-1 after:w-0.5 after:bg-connexio-accent after:rounded-full"
		: "";

	return (
		<div
			ref={tabRef}
			role="tab"
			tabIndex={0}
			aria-selected={isActive}
			draggable={!isEditing}
			className={`relative group flex items-center gap-1 px-1 h-9 min-w-[100px] max-w-[200px] border-r border-connexio-border cursor-pointer transition-colors select-none ${
				isActive
					? "bg-connexio-bg border-b-2 border-b-connexio-accent"
					: "hover:bg-connexio-bg-tertiary"
			} ${dragIndicatorClass} ${isDragging ? "opacity-40" : ""}`}
			onClick={() => {
				if (!isEditing) onSelect();
			}}
			onContextMenu={handleContextMenu}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					if (!isEditing) onSelect();
				}
				if (e.key === "F2") {
					e.preventDefault();
					setEditValue(label);
					setIsEditing(true);
				}
			}}
			onDragStart={(e) => {
				e.dataTransfer.effectAllowed = "move";
				e.dataTransfer.setData("text/plain", id);
				e.dataTransfer.setData("application/connexio-tab", id);
				if (tabRef.current) {
					e.dataTransfer.setDragImage(tabRef.current, 0, 0);
				}
				onDragStart(index);
			}}
			onDragOver={(e) => {
				e.preventDefault();
				e.dataTransfer.dropEffect = "move";
				onDragOver(index);
			}}
			onDrop={(e) => {
				e.preventDefault();
				e.stopPropagation();
				onDrop();
			}}
			onDragEnd={() => {
				onDragEnd();
			}}
		>
			{/* Drag handle */}
			<div className="flex-shrink-0 opacity-0 group-hover:opacity-40 hover:!opacity-80 cursor-grab active:cursor-grabbing transition-opacity">
				<GripVertical size={10} className="text-connexio-text-muted" />
			</div>

			{/* Label or input — takes remaining space */}
			{isEditing ? (
				<input
					ref={inputRef}
					type="text"
					value={editValue}
					onChange={(e) => setEditValue(e.target.value)}
					onBlur={commitRename}
					onKeyDown={handleInputKeyDown}
					onClick={(e) => e.stopPropagation()}
					onMouseDown={(e) => e.stopPropagation()}
					className="flex-1 text-xs bg-connexio-bg-tertiary text-connexio-text border border-connexio-accent rounded px-1 py-0.5 outline-none min-w-0"
					maxLength={30}
				/>
			) : (
				<span
					className={`flex-1 text-xs truncate px-1 ${
						isActive ? "text-connexio-text" : "text-connexio-text-secondary"
					}`}
					onDoubleClick={handleDoubleClick}
					title="Double-click to rename"
				>
					{label}
				</span>
			)}

			{/* Unsaved indicator dot */}
			{isDirty && (
				<span className="w-1.5 h-1.5 rounded-full bg-connexio-accent flex-shrink-0" title="Unsaved changes" />
			)}

			{/* Close button — always pinned to the right */}
			{canClose && !isEditing && (
				<button
					onClick={(e) => {
						e.stopPropagation();
						onClose();
					}}
					className="flex-shrink-0 ml-auto opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 transition-all"
					type="button"
				>
					<X size={10} className="text-connexio-text-muted" />
				</button>
			)}

			{/* Context Menu */}
			{contextMenu && (
				<TabContextMenu
					x={contextMenu.x}
					y={contextMenu.y}
					onRename={() => {
						setContextMenu(null);
						setEditValue(label);
						setIsEditing(true);
					}}
				/>
			)}
		</div>
	);
}

// === Tab Context Menu ===

function TabContextMenu({
	x,
	y,
	onRename,
}: {
	x: number;
	y: number;
	onRename: () => void;
}) {
	const menuRef = useRef<HTMLDivElement>(null);

	// Adjust position if menu would overflow viewport
	const [pos, setPos] = useState({ x, y });
	useEffect(() => {
		if (!menuRef.current) return;
		const rect = menuRef.current.getBoundingClientRect();
		const newX = x + rect.width > window.innerWidth ? window.innerWidth - rect.width - 4 : x;
		const newY = y + rect.height > window.innerHeight ? window.innerHeight - rect.height - 4 : y;
		setPos({ x: newX, y: newY });
	}, [x, y]);

	return (
		<div
			ref={menuRef}
			data-tab-context-menu=""
			className="fixed z-[200] min-w-[140px] py-1 bg-connexio-bg-secondary border border-connexio-border rounded-md shadow-xl"
			style={{ top: pos.y, left: pos.x }}
			onMouseDown={(e) => e.stopPropagation()}
			onClick={(e) => e.stopPropagation()}
			onContextMenu={(e) => e.preventDefault()}
		>
			<button
				onClick={onRename}
				className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-connexio-text hover:bg-connexio-bg-tertiary transition-colors text-left"
				type="button"
			>
				<Pencil size={12} className="text-connexio-text-muted" />
				Rename
				<span className="ml-auto text-[10px] text-connexio-text-muted">F2</span>
			</button>
		</div>
	);
}
