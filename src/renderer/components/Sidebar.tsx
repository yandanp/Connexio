import {
	ChevronDown,
	ChevronRight,
	FolderOpen,
	GripVertical,
	PanelLeftClose,
	PanelLeftOpen,
	Plus,
	Search,
	Trash2,
	X,
} from "lucide-react";
import ContextMenu from "./ContextMenu";
import { useEffect, useState } from "react";
import type { Project } from "../../shared/types";
import { useProjectStore } from "../stores/projectStore";
import AddProjectModal from "./AddProjectModal";
import ConfirmDialog from "./ConfirmDialog";

export default function Sidebar() {
	const {
		projects,
		activeProjectId,
		searchQuery,
		sidebarCollapsed,
		workspaceTabs,
		setSearchQuery,
		setActiveProject,
		deleteProject,
		renameProject,
		toggleSidebar,
		reorderProjects,
		moveProjectToGroup,
		renameProjectGroup,
	} = useProjectStore();

	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["default"]));
	const [showAddModal, setShowAddModal] = useState(false);
	const [deleteConfirmProject, setDeleteConfirmProject] = useState<Project | null>(null);
	const [contextMenu, setContextMenu] = useState<
		| { type: "project"; x: number; y: number; project: Project }
		| { type: "group"; x: number; y: number; group: string }
		| null
	>(null);
	const [inputDialog, setInputDialog] = useState<{
		title: string;
		message: string;
		label: string;
		initialValue: string;
		confirmLabel: string;
		options?: string[];
		onConfirm: (value: string) => void | Promise<void>;
	} | null>(null);
	const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
	const [editingGroup, setEditingGroup] = useState<string | null>(null);
	const [editValue, setEditValue] = useState("");

	// Drag state
	const [dragProjectId, setDragProjectId] = useState<string | null>(null);
	const [dragOverId, setDragOverId] = useState<string | null>(null);
	const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);

	const toggleGroup = (group: string) => {
		const next = new Set(expandedGroups);
		if (next.has(group)) {
			next.delete(group);
		} else {
			next.add(group);
		}
		setExpandedGroups(next);
	};

	const getProjectTabCount = (projectId: string) => workspaceTabs[projectId]?.length || 0;

	// Group projects
	const grouped = projects.reduce(
		(acc, project) => {
			const group = project.group || "default";
			if (!acc[group]) acc[group] = [];
			acc[group].push(project);
			return acc;
		},
		{} as Record<string, Project[]>,
	);

	// Filter by project name, path, or group.
	const normalizedQuery = searchQuery.trim().toLowerCase();
	const filteredGroups = Object.entries(grouped).reduce(
		(acc, [group, items]) => {
			const filtered = items.filter((p) => {
				if (!normalizedQuery) return true;
				return [p.name, p.path, p.group || "default"].some((value) =>
					value.toLowerCase().includes(normalizedQuery),
				);
			});
			if (filtered.length > 0) acc[group] = filtered;
			return acc;
		},
		{} as Record<string, Project[]>,
	);

	// Drag handlers
	const handleDragStart = (projectId: string) => {
		setDragProjectId(projectId);
	};

	const handleDragOverProject = (e: React.DragEvent, targetId: string) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		if (dragProjectId && dragProjectId !== targetId) {
			setDragOverId(targetId);
			setDragOverGroup(null);
		}
	};

	const handleDragOverGroup = (e: React.DragEvent, group: string) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		if (dragProjectId) {
			setDragOverGroup(group);
			setDragOverId(null);
		}
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();

		if (!dragProjectId) return;

		if (dragOverId) {
			// Reorder: drop on another project
			reorderProjects(dragProjectId, dragOverId);
		} else if (dragOverGroup) {
			// Move to group: drop on group header
			moveProjectToGroup(dragProjectId, dragOverGroup);
		}

		resetDrag();
	};

	const resetDrag = () => {
		setDragProjectId(null);
		setDragOverId(null);
		setDragOverGroup(null);
	};

	const renameProjectFromMenu = (project: Project) => {
		setInputDialog({
			title: "Rename Project",
			message: "Update the display name shown in the sidebar.",
			label: "Project name",
			initialValue: project.name,
			confirmLabel: "Rename",
			onConfirm: (value) => renameProject(project.id, value),
		});
	};

	const moveProjectFromMenu = (project: Project) => {
		const groups = Array.from(new Set(projects.map((p) => p.group || "default"))).sort();
		setInputDialog({
			title: "Change Group",
			message: `Move "${project.name}" to another sidebar group, or type a new one.`,
			label: "Group name",
			initialValue: project.group || "default",
			confirmLabel: "Move",
			options: groups,
			onConfirm: (value) => moveProjectToGroup(project.id, value),
		});
	};

	const renameGroupFromMenu = (group: string) => {
		setInputDialog({
			title: "Rename Group",
			message: `Rename group "${group}" for all projects inside it.`,
			label: "Group name",
			initialValue: group,
			confirmLabel: "Rename",
			onConfirm: (value) => renameProjectGroup(group, value),
		});
	};

	const startProjectInlineRename = (project: Project) => {
		setEditingProjectId(project.id);
		setEditingGroup(null);
		setEditValue(project.name);
	};

	const startGroupInlineRename = (group: string) => {
		setEditingGroup(group);
		setEditingProjectId(null);
		setEditValue(group);
	};

	const commitInlineRename = async () => {
		const value = editValue.trim();
		if (!value) {
			setEditingProjectId(null);
			setEditingGroup(null);
			return;
		}
		if (editingProjectId) await renameProject(editingProjectId, value);
		if (editingGroup) await renameProjectGroup(editingGroup, value);
		setEditingProjectId(null);
		setEditingGroup(null);
	};

	if (sidebarCollapsed) {
		return (
			<div className="w-12 glass-panel flex flex-col items-center gap-2 py-2 soft-separator-right transition-[width] duration-200">
				<button
					onClick={toggleSidebar}
					className="p-2 rounded hover:bg-connexio-bg-tertiary transition-colors"
					type="button"
				>
					<PanelLeftOpen size={16} className="text-connexio-text-secondary" />
				</button>
			</div>
		);
	}

	return (
		<>
			<div className="w-64 glass-panel flex flex-col soft-separator-right">
				{/* Header */}
				<div className="flex h-10 items-center justify-between px-3">
					<span className="text-[10px] font-bold text-connexio-text-secondary uppercase tracking-[0.18em]">
						Projects
					</span>
					<div className="flex items-center gap-1">
						<button
							onClick={() => setShowAddModal(true)}
							className="p-1.5 rounded-lg hover:bg-connexio-bg-tertiary transition-colors"
							title="Add Project"
							type="button"
						>
							<Plus size={14} className="text-connexio-text-secondary" />
						</button>
						<button
							onClick={toggleSidebar}
							className="p-1.5 rounded-lg hover:bg-connexio-bg-tertiary transition-colors"
							type="button"
						>
							<PanelLeftClose size={14} className="text-connexio-text-secondary" />
						</button>
					</div>
				</div>

				{/* Search */}
				<div className="flex h-10 items-center px-3">
					<div className="flex h-7 w-full items-center gap-2 rounded-lg bg-connexio-bg-tertiary/65 px-2.5">
						<Search size={13} className="text-connexio-text-muted" />
						<input
							type="text"
							placeholder="Search name, path, group..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="bg-transparent text-[13px] text-connexio-text outline-none flex-1 placeholder:text-connexio-text-muted"
						/>
						{searchQuery && (
							<button
								onClick={() => setSearchQuery("")}
								className="p-0.5 rounded hover:bg-connexio-bg"
								type="button"
								title="Clear search"
							>
								<X size={11} className="text-connexio-text-muted" />
							</button>
						)}
					</div>
				</div>

				{/* Project list */}
				<div className="flex-1 overflow-y-auto px-2.5 pt-2 pb-2.5">
					{Object.entries(filteredGroups).map(([group, items]) => (
						<div key={group} className="mb-2">
							{/* Group header — drop target for moving project to group */}
							<button
								onClick={() => toggleGroup(group)}
								onContextMenu={(e) => {
									e.preventDefault();
									setContextMenu({ type: "group", x: e.clientX, y: e.clientY, group });
								}}
								className={`flex items-center gap-1.5 px-2 py-1.5 w-full text-left rounded-lg bg-connexio-bg/35 transition-colors ${
									dragOverGroup === group
										? "bg-connexio-accent/15 border border-connexio-accent/40"
										: "hover:bg-connexio-bg-tertiary border border-transparent"
								}`}
								type="button"
								onDragOver={(e) => handleDragOverGroup(e, group)}
								onDrop={handleDrop}
								onDragLeave={() => setDragOverGroup(null)}
							>
								{expandedGroups.has(group) ? (
									<ChevronDown size={12} className="text-connexio-text-muted" />
								) : (
									<ChevronRight size={12} className="text-connexio-text-muted" />
								)}
								{editingGroup === group ? (
									<input
										autoFocus
										value={editValue}
										onChange={(e) => setEditValue(e.target.value)}
										onClick={(e) => e.stopPropagation()}
										onBlur={commitInlineRename}
										onKeyDown={(e) => {
											e.stopPropagation();
											if (e.key === "Enter") commitInlineRename();
											if (e.key === "Escape") setEditingGroup(null);
										}}
										className="min-w-0 flex-1 rounded border border-connexio-accent bg-connexio-bg px-1 py-0.5 text-[13px] text-connexio-text outline-none"
									/>
								) : (
									<span
										className="text-[13px] font-medium text-connexio-text-secondary capitalize"
										onDoubleClick={(e) => {
											e.stopPropagation();
											startGroupInlineRename(group);
										}}
									>
										{group}
									</span>
								)}
								<span className="text-[11px] text-connexio-text-muted ml-auto">{items.length}</span>
							</button>

							{/* Project items */}
							{expandedGroups.has(group) && (
								<div className="ml-2 mt-1 space-y-1">
									{items.map((project) => (
										<div
											key={project.id}
											role="button"
											tabIndex={0}
											draggable
											className={`group interaction-lift flex items-center gap-1.5 px-1.5 py-1.5 rounded-lg cursor-pointer transition-all duration-150 select-none ${
												dragOverId === project.id
													? "bg-connexio-accent/15 border border-connexio-accent/40"
													: activeProjectId === project.id
														? "bg-connexio-accent/12 border border-transparent shadow-[inset_2px_0_0_var(--accent-color),0_8px_22px_rgba(56,189,248,0.05)]"
														: "hover:bg-connexio-bg-tertiary border border-transparent"
											} ${dragProjectId === project.id ? "opacity-40" : ""}`}
											onClick={() => {
												if (!editingProjectId) setActiveProject(project.id);
											}}
											onDoubleClick={() => startProjectInlineRename(project)}
											onContextMenu={(e) => {
												e.preventDefault();
												setContextMenu({ type: "project", x: e.clientX, y: e.clientY, project });
											}}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ") {
													e.preventDefault();
													setActiveProject(project.id);
												}
											}}
											onDragStart={(e) => {
												e.dataTransfer.effectAllowed = "move";
												e.dataTransfer.setData("text/plain", project.id);
												handleDragStart(project.id);
											}}
											onDragOver={(e) => handleDragOverProject(e, project.id)}
											onDrop={handleDrop}
											onDragEnd={resetDrag}
										>
											{/* Drag handle */}
											<div className="flex-shrink-0 opacity-0 group-hover:opacity-40 hover:!opacity-80 cursor-grab active:cursor-grabbing transition-opacity">
												<GripVertical size={10} className="text-connexio-text-muted" />
											</div>
											<FolderOpen
												size={13}
												className={
													activeProjectId === project.id
														? "text-connexio-accent flex-shrink-0"
														: "text-connexio-text-muted flex-shrink-0"
												}
											/>
											{editingProjectId === project.id ? (
												<input
													autoFocus
													value={editValue}
													onChange={(e) => setEditValue(e.target.value)}
													onClick={(e) => e.stopPropagation()}
													onBlur={commitInlineRename}
													onKeyDown={(e) => {
														e.stopPropagation();
														if (e.key === "Enter") commitInlineRename();
														if (e.key === "Escape") setEditingProjectId(null);
													}}
													className="min-w-0 flex-1 rounded border border-connexio-accent bg-connexio-bg px-1 py-0.5 text-[13px] text-connexio-text outline-none"
												/>
											) : (
												<div className="min-w-0 flex-1">
													<span className="block truncate text-[13px] font-medium text-connexio-text">
														{project.name}
													</span>
													{activeProjectId === project.id && (
														<span className="block truncate text-[9px] text-connexio-text-muted">
															{getProjectTabCount(project.id)} tab
															{getProjectTabCount(project.id) !== 1 ? "s" : ""}
														</span>
													)}
												</div>
											)}
											<button
												onClick={(e) => {
													e.stopPropagation();
													setDeleteConfirmProject(project);
												}}
												className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 transition-all flex-shrink-0"
												type="button"
											>
												<Trash2 size={11} className="text-red-400" />
											</button>
										</div>
									))}
								</div>
							)}
						</div>
					))}

					{Object.keys(filteredGroups).length === 0 && (
						<div className="text-center py-8">
							<p className="text-xs text-connexio-text-muted">No projects found</p>
						</div>
					)}
				</div>
			</div>

			{contextMenu && (
				<SidebarContextMenu
					x={contextMenu.x}
					y={contextMenu.y}
					onClose={() => setContextMenu(null)}
					items={
						contextMenu.type === "project"
							? [
									{
										label: "Open Project",
										onClick: () => setActiveProject(contextMenu.project.id),
									},
									{
										label: "Rename Project",
										onClick: () => renameProjectFromMenu(contextMenu.project),
									},
									{
										label: "Change Group",
										onClick: () => moveProjectFromMenu(contextMenu.project),
									},
									{
										label: "Remove Project",
										danger: true,
										onClick: () => setDeleteConfirmProject(contextMenu.project),
									},
								]
							: [{ label: "Rename Group", onClick: () => renameGroupFromMenu(contextMenu.group) }]
					}
				/>
			)}

			{showAddModal && <AddProjectModal onClose={() => setShowAddModal(false)} />}

			{inputDialog && (
				<SidebarInputDialog
					title={inputDialog.title}
					message={inputDialog.message}
					label={inputDialog.label}
					initialValue={inputDialog.initialValue}
					confirmLabel={inputDialog.confirmLabel}
					options={inputDialog.options}
					onConfirm={async (value) => {
						await inputDialog.onConfirm(value);
						setInputDialog(null);
					}}
					onCancel={() => setInputDialog(null)}
				/>
			)}

			{deleteConfirmProject && (
				<ConfirmDialog
					title="Remove Project"
					message={`Remove "${deleteConfirmProject.name}" from Connexio? This won't delete any files on disk.`}
					confirmLabel="Remove"
					cancelLabel="Cancel"
					variant="danger"
					onConfirm={() => {
						deleteProject(deleteConfirmProject.id);
						setDeleteConfirmProject(null);
					}}
					onCancel={() => setDeleteConfirmProject(null)}
				/>
			)}
		</>
	);
}

function SidebarInputDialog({
	title,
	message,
	label,
	initialValue,
	confirmLabel,
	options,
	onConfirm,
	onCancel,
}: {
	title: string;
	message: string;
	label: string;
	initialValue: string;
	confirmLabel: string;
	options?: string[];
	onConfirm: (value: string) => void | Promise<void>;
	onCancel: () => void;
}) {
	const [value, setValue] = useState(initialValue);
	const [error, setError] = useState("");

	useEffect(() => {
		const handleKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onCancel();
		};
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [onCancel]);

	const submit = async () => {
		const trimmed = value.trim();
		if (!trimmed) {
			setError(`${label} is required.`);
			return;
		}
		await onConfirm(trimmed);
	};

	return (
		<div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/50 backdrop-blur-sm">
			<div className="w-[360px] overflow-hidden rounded-lg border border-connexio-border bg-connexio-bg-secondary shadow-2xl">
				<div className="border-b border-connexio-border px-4 py-3">
					<h3 className="text-sm font-semibold text-connexio-text">{title}</h3>
					<p className="mt-1 text-xs text-connexio-text-muted">{message}</p>
				</div>
				<div className="space-y-2 px-4 py-3">
					<label className="block text-xs font-medium text-connexio-text-secondary">{label}</label>
					{options && options.length > 0 && (
						<select
							value={options.includes(value) ? value : "__custom"}
							onChange={(event) => {
								if (event.target.value === "__custom") return;
								setValue(event.target.value);
								setError("");
							}}
							className="w-full rounded border border-connexio-border bg-connexio-bg-tertiary px-3 py-2 text-sm text-connexio-text outline-none transition-colors focus:border-connexio-accent"
						>
							{options.map((option) => (
								<option key={option} value={option}>
									{option}
								</option>
							))}
							<option value="__custom">New group...</option>
						</select>
					)}
					<input
						autoFocus
						type="text"
						placeholder={options ? "Type a new group or edit selected" : undefined}
						value={value}
						onChange={(event) => {
							setValue(event.target.value);
							setError("");
						}}
						onKeyDown={(event) => {
							if (event.key === "Enter") submit();
						}}
						className="w-full rounded border border-connexio-border bg-connexio-bg-tertiary px-3 py-2 text-sm text-connexio-text outline-none transition-colors focus:border-connexio-accent"
					/>
					{error && <p className="text-xs text-red-400">{error}</p>}
				</div>
				<div className="flex items-center justify-end gap-2 border-t border-connexio-border bg-connexio-bg-tertiary/50 px-4 py-3">
					<button
						onClick={onCancel}
						className="rounded border border-connexio-border bg-connexio-bg-tertiary px-3 py-1.5 text-xs font-medium text-connexio-text-secondary transition-colors hover:bg-connexio-bg hover:text-connexio-text"
						type="button"
					>
						Cancel
					</button>
					<button
						onClick={submit}
						className="rounded bg-connexio-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-connexio-accent-hover"
						type="button"
					>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>
	);
}

function SidebarContextMenu({
	x,
	y,
	items,
	onClose,
}: {
	x: number;
	y: number;
	items: Array<{ label: string; danger?: boolean; onClick: () => void | Promise<void> }>;
	onClose: () => void;
}) {
	return (
		<ContextMenu
			x={x}
			y={y}
			onClose={onClose}
			minWidth={176}
			items={items.map((item) => ({
				label: item.label,
				danger: item.danger,
				onClick: item.onClick,
			}))}
		/>
	);
}
