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
} from "lucide-react";
import { useState } from "react";
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
		setSearchQuery,
		setActiveProject,
		deleteProject,
		toggleSidebar,
		reorderProjects,
		moveProjectToGroup,
	} = useProjectStore();

	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
		new Set(["default"]),
	);
	const [showAddModal, setShowAddModal] = useState(false);
	const [deleteConfirmProject, setDeleteConfirmProject] =
		useState<Project | null>(null);

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

	// Filter by search
	const filteredGroups = Object.entries(grouped).reduce(
		(acc, [group, items]) => {
			const filtered = items.filter((p) =>
				p.name.toLowerCase().includes(searchQuery.toLowerCase()),
			);
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

	if (sidebarCollapsed) {
		return (
			<div className="w-12 bg-connexio-bg-secondary border-r border-connexio-border flex flex-col items-center py-3 gap-2">
				<button
					onClick={toggleSidebar}
					className="p-2 rounded hover:bg-connexio-bg-tertiary transition-colors"
					type="button"
					aria-label="Expand sidebar"
				>
					<PanelLeftOpen size={16} className="text-connexio-text-secondary" />
				</button>
			</div>
		);
	}

	return (
		<>
			<div className="w-64 bg-connexio-bg-secondary border-r border-connexio-border flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-between px-3 py-2 border-b border-connexio-border">
					<span className="text-xs font-semibold text-connexio-text-secondary uppercase tracking-wider">
						Projects
					</span>
					<div className="flex items-center gap-1">
						<button
							onClick={() => setShowAddModal(true)}
							className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
							title="Add Project"
							type="button"
							aria-label="Add Project"
						>
							<Plus size={14} className="text-connexio-text-secondary" />
						</button>
						<button
							onClick={toggleSidebar}
							className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
							type="button"
							aria-label="Collapse sidebar"
						>
							<PanelLeftClose
								size={14}
								className="text-connexio-text-secondary"
							/>
						</button>
					</div>
				</div>

				{/* Search */}
				<div className="px-3 py-2">
					<div className="flex items-center gap-2 px-2 py-1.5 rounded bg-connexio-bg-tertiary border border-connexio-border">
						<Search size={12} className="text-connexio-text-muted" />
						<input
							type="text"
							placeholder="Search projects..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="bg-transparent text-xs text-connexio-text outline-none flex-1 placeholder:text-connexio-text-muted"
						/>
					</div>
				</div>

				{/* Project list */}
				<div className="flex-1 overflow-y-auto px-2 py-1">
					{Object.entries(filteredGroups).map(([group, items]) => (
						<div key={group} className="mb-2">
							{/* Group header — drop target for moving project to group */}
							<button
								onClick={() => toggleGroup(group)}
								className={`flex items-center gap-1 px-2 py-1 w-full text-left rounded transition-colors ${
									dragOverGroup === group
										? "bg-connexio-accent/15 border border-connexio-accent/40"
										: "hover:bg-connexio-bg-tertiary border border-transparent"
								}`}
								type="button"
								aria-label={`Toggle group ${group}`}
								onDragOver={(e) => handleDragOverGroup(e, group)}
								onDrop={handleDrop}
								onDragLeave={() => setDragOverGroup(null)}
							>
								{expandedGroups.has(group) ? (
									<ChevronDown size={12} className="text-connexio-text-muted" />
								) : (
									<ChevronRight
										size={12}
										className="text-connexio-text-muted"
									/>
								)}
								<span className="text-xs font-medium text-connexio-text-secondary capitalize">
									{group}
								</span>
								<span className="text-[10px] text-connexio-text-muted ml-auto">
									{items.length}
								</span>
							</button>

							{/* Project items */}
							{expandedGroups.has(group) && (
								<div className="ml-3 mt-0.5 space-y-0.5">
									{items.map((project) => (
										<div
											key={project.id}
											role="button"
											tabIndex={0}
											draggable
											className={`group flex items-center gap-1 px-1 py-1.5 rounded cursor-pointer transition-colors select-none ${
												dragOverId === project.id
													? "bg-connexio-accent/15 border border-connexio-accent/40"
													: activeProjectId === project.id
														? "bg-connexio-accent/10 border border-connexio-accent/30"
														: "hover:bg-connexio-bg-tertiary border border-transparent"
											} ${dragProjectId === project.id ? "opacity-40" : ""}`}
											onClick={() => setActiveProject(project.id)}
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
												<GripVertical
													size={10}
													className="text-connexio-text-muted"
												/>
											</div>
											<FolderOpen
												size={13}
												className={
													activeProjectId === project.id
														? "text-connexio-accent flex-shrink-0"
														: "text-connexio-text-muted flex-shrink-0"
												}
											/>
											<span className="text-xs text-connexio-text truncate flex-1">
												{project.name}
											</span>
											<button
												onClick={(e) => {
													e.stopPropagation();
													setDeleteConfirmProject(project);
												}}
												className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 transition-all flex-shrink-0"
												type="button"
												aria-label={`Delete project ${project.name}`}
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
							<p className="text-xs text-connexio-text-muted">
								No projects found
							</p>
						</div>
					)}
				</div>
			</div>

			{showAddModal && (
				<AddProjectModal onClose={() => setShowAddModal(false)} />
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
