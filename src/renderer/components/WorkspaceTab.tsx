import { Code2, FileCode, Globe, GripVertical, HardDrive, Pencil, Server, Terminal, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface TabProps {
	id: string;
	label: string;
	isActive: boolean;
	index: number;
	canClose: boolean;
	isDirty?: boolean;
	tabType?: "terminal" | "editor" | "preview" | "remoteEditor" | "sshManager" | "sftp";
	detail?: string;
	splitCount?: number;
	status?: "active" | "running" | "exited";
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
	detail,
	splitCount,
	status,
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
			? "before:absolute before:left-1 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-connexio-accent before:rounded-full before:shadow-[0_0_10px_var(--accent-color)]"
			: "after:absolute after:right-1 after:top-1.5 after:bottom-1.5 after:w-0.5 after:bg-connexio-accent after:rounded-full after:shadow-[0_0_10px_var(--accent-color)]"
		: "";

	const TabIcon =
		tabType === "editor" || tabType === "remoteEditor"
			? FileCode
			: tabType === "preview"
				? Globe
				: tabType === "sshManager"
					? Server
					: tabType === "sftp"
						? HardDrive
						: tabType === "terminal"
							? Terminal
							: Code2;
	const typeLabel = tabType === "remoteEditor" ? "remote editor" : tabType || "terminal";
	const showStatus = status && tabType !== "editor" && tabType !== "remoteEditor" && tabType !== "preview";
	const statusLabel = status === "running" ? "Running" : status === "exited" ? "Exited" : "Ready";
	const tooltip = [label, typeLabel, statusLabel, detail, splitCount && splitCount > 1 ? `${splitCount} panes` : null]
		.filter(Boolean)
		.join(" - ");

	return (
		<div
			ref={tabRef}
			role="tab"
			tabIndex={0}
			aria-selected={isActive}
			title={tooltip}
			draggable={!isEditing}
			className={`interaction-lift relative group mx-0.5 flex h-7 min-w-[110px] max-w-[210px] cursor-pointer select-none items-center gap-1 rounded-md border px-1.5 transition-all duration-150 ${
				isActive
					? "border-transparent bg-connexio-bg-elevated text-connexio-text shadow-[inset_2px_0_0_var(--accent-color),inset_0_1px_0_rgba(255,255,255,0.05),0_6px_18px_rgba(0,0,0,0.18)]"
					: "border-transparent text-connexio-text-muted hover:bg-connexio-bg-tertiary/70 hover:text-connexio-text-secondary"
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

			<span className="relative flex flex-shrink-0 items-center">
				<TabIcon
					size={12}
					className={isActive ? "text-connexio-accent" : "text-connexio-text-muted"}
				/>
				{showStatus && (
					<span
						className={`absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full ring-2 ring-connexio-bg-elevated ${status === "running" ? "animate-pulse bg-[var(--success-color)] shadow-[0_0_8px_rgba(52,211,153,0.7)]" : status === "exited" ? "bg-connexio-text-muted/45" : "bg-connexio-accent/80"}`}
						title={statusLabel}
					/>
				)}
			</span>

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
					className="min-w-0 flex-1 rounded-md border border-connexio-accent bg-connexio-bg-tertiary px-1 py-0.5 text-xs text-connexio-text outline-none"
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

			{showStatus && status === "running" && isActive && !isEditing && (
				<span className="rounded-full bg-[var(--success-color)]/10 px-1.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--success-color)]">
					Run
				</span>
			)}

			{showStatus && status === "exited" && isActive && !isEditing && (
				<span className="rounded-full bg-white/[0.035] px-1.5 text-[9px] font-semibold uppercase tracking-wide text-connexio-text-muted">
					Done
				</span>
			)}

			{splitCount && splitCount > 1 && !isEditing && (
				<span className="rounded bg-white/[0.04] px-1 text-[9px] font-semibold text-connexio-text-muted" title={`${splitCount} panes`}>
					{splitCount}
				</span>
			)}

			{/* Unsaved indicator dot */}
			{isDirty && (
				<span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-connexio-accent shadow-[0_0_10px_var(--accent-color)]" title="Unsaved changes" />
			)}

			{/* Close button — always pinned to the right */}
			{canClose && !isEditing && (
				<button
					onClick={(e) => {
						e.stopPropagation();
						onClose();
					}}
					className="ml-auto flex-shrink-0 rounded-md p-0.5 opacity-0 transition-all hover:bg-red-500/20 group-hover:opacity-100"
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
			className="fixed z-[200] min-w-[140px] rounded-lg border border-connexio-border bg-connexio-bg-secondary py-1 shadow-2xl"
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
