import {
	Bookmark,
	FileJson,
	Check,
	ChevronDown,
	ChevronRight,
	GripVertical,
	Pencil,
	Play,
	Plus,
	Trash2,
	X,
	Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import type { PinnedCommand, TaskScript } from "../../../shared/types";

interface Props {
	projectId: string;
	projectPath: string;
	onRunCommand: (command: string) => void;
}

export default function TaskPanel({ projectId, projectPath, onRunCommand }: Props) {
	const [tasks, setTasks] = useState<TaskScript[]>([]);
	const [pinnedCommands, setPinnedCommands] = useState<PinnedCommand[]>([]);
	const [showTasks, setShowTasks] = useState(true);
	const [showPinned, setShowPinned] = useState(true);
	const [isAddingCommand, setIsAddingCommand] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [newLabel, setNewLabel] = useState("");
	const [newCommand, setNewCommand] = useState("");

	// Drag state for pinned commands
	const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

	// Load tasks & pinned commands
	useEffect(() => {
		window.connexio.tasks
			.detect(projectPath)
			.then(setTasks)
			.catch(() => {});
		window.connexio.pinned
			.list(projectId)
			.then(setPinnedCommands)
			.catch(() => {});
	}, [projectId, projectPath]);

	const savePinned = async (commands: PinnedCommand[]) => {
		setPinnedCommands(commands);
		await window.connexio.pinned.save(projectId, commands);
	};

	const handleAddPinned = async () => {
		if (!newLabel.trim() || !newCommand.trim()) return;
		const cmd: PinnedCommand = {
			id: uuid(),
			label: newLabel.trim(),
			command: newCommand.trim(),
		};
		await savePinned([...pinnedCommands, cmd]);
		setNewLabel("");
		setNewCommand("");
		setIsAddingCommand(false);
	};

	const handleDeletePinned = async (id: string) => {
		await savePinned(pinnedCommands.filter((c) => c.id !== id));
	};

	const handleStartEdit = (cmd: PinnedCommand) => {
		setEditingId(cmd.id);
		setNewLabel(cmd.label);
		setNewCommand(cmd.command);
	};

	const handleSaveEdit = async () => {
		if (!editingId || !newLabel.trim() || !newCommand.trim()) {
			handleCancelEdit();
			return;
		}
		const updated = pinnedCommands.map((c) =>
			c.id === editingId ? { ...c, label: newLabel.trim(), command: newCommand.trim() } : c,
		);
		await savePinned(updated);
		handleCancelEdit();
	};

	const handleCancelEdit = () => {
		setEditingId(null);
		setNewLabel("");
		setNewCommand("");
	};

	// Drag & drop reorder
	const handleDragEnd = async () => {
		if (dragFromIndex !== null && dragOverIndex !== null && dragFromIndex !== dragOverIndex) {
			const reordered = [...pinnedCommands];
			const [moved] = reordered.splice(dragFromIndex, 1);
			reordered.splice(dragOverIndex, 0, moved);
			await savePinned(reordered);
		}
		setDragFromIndex(null);
		setDragOverIndex(null);
	};

	return (
		<div className="flex h-full flex-col overflow-y-auto bg-connexio-bg-secondary/35">
			{/* Pinned Commands */}
			<div className="shadow-[inset_0_-1px_0_rgba(255,255,255,0.05)]">
				<button
					onClick={() => setShowPinned(!showPinned)}
					className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.035]"
					type="button"
				>
					{showPinned ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
					<Bookmark size={11} className="text-connexio-accent" />
					<span className="section-label">Pinned</span>
					<span className="text-[9px] text-connexio-text-muted ml-auto">
						{pinnedCommands.length}
					</span>
				</button>

				{showPinned && (
					<div className="space-y-1 px-2 pb-2">
						{pinnedCommands.length === 0 && !isAddingCommand && (
							<PanelEmptyState
								icon={<Bookmark size={18} />}
								title="No pinned commands yet"
								description="Save commands you run often, then launch them from this panel or Ctrl+K."
								actionLabel="Pin a command"
								onAction={() => setIsAddingCommand(true)}
							/>
						)}
						{pinnedCommands.map((cmd, index) =>
							editingId === cmd.id ? (
								/* Edit mode */
								<PinnedEditForm
									key={cmd.id}
									label={newLabel}
									command={newCommand}
									onLabelChange={setNewLabel}
									onCommandChange={setNewCommand}
									onSave={handleSaveEdit}
									onCancel={handleCancelEdit}
								/>
							) : (
								/* Display mode */
								<div
									key={cmd.id}
									draggable
									className={`group flex items-center gap-1 rounded-lg px-1.5 py-1.5 transition-colors select-none ${
										dragOverIndex === index
											? "bg-connexio-accent/15 border border-connexio-accent/40"
											: "hover:bg-white/[0.04] border border-transparent"
									} ${dragFromIndex === index ? "opacity-40" : ""}`}
									onDragStart={(e) => {
										e.dataTransfer.effectAllowed = "move";
										setDragFromIndex(index);
									}}
									onDragOver={(e) => {
										e.preventDefault();
										if (dragFromIndex !== null && dragFromIndex !== index) {
											setDragOverIndex(index);
										}
									}}
									onDragLeave={() => setDragOverIndex(null)}
									onDrop={(e) => {
										e.preventDefault();
										handleDragEnd();
									}}
									onDragEnd={() => {
										setDragFromIndex(null);
										setDragOverIndex(null);
									}}
								>
									{/* Drag handle */}
									<div className="flex-shrink-0 opacity-0 group-hover:opacity-40 hover:!opacity-80 cursor-grab active:cursor-grabbing transition-opacity">
										<GripVertical size={9} className="text-connexio-text-muted" />
									</div>

									{/* Run button + label */}
									<button
										onClick={() => onRunCommand(cmd.command)}
										className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
										type="button"
										title={`Run: ${cmd.command}`}
									>
										<Play size={9} className="text-green-400 flex-shrink-0" />
										<div className="flex flex-col min-w-0">
											<span className="text-[11px] text-connexio-text truncate leading-tight">
												{cmd.label}
											</span>
											<span className="text-[9px] text-connexio-text-muted truncate leading-tight">
												{cmd.command}
											</span>
										</div>
									</button>

									{/* Action buttons */}
									<div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
										<button
											onClick={() => handleStartEdit(cmd)}
											className="dock-button p-0.5 transition-colors"
											type="button"
											title="Edit"
										>
											<Pencil size={9} className="text-connexio-text-muted" />
										</button>
										<button
											onClick={() => handleDeletePinned(cmd.id)}
											className="p-0.5 rounded hover:bg-red-500/20 transition-colors"
											type="button"
											title="Delete"
										>
											<Trash2 size={9} className="text-red-400" />
										</button>
									</div>
								</div>
							),
						)}

						{/* Add command */}
						{isAddingCommand ? (
							<PinnedEditForm
								label={newLabel}
								command={newCommand}
								onLabelChange={setNewLabel}
								onCommandChange={setNewCommand}
								onSave={handleAddPinned}
								onCancel={() => {
									setIsAddingCommand(false);
									setNewLabel("");
									setNewCommand("");
								}}
								isNew
							/>
						) : (
							<button
								onClick={() => setIsAddingCommand(true)}
								className="flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] text-connexio-text-muted transition-colors hover:bg-white/[0.035] hover:text-connexio-text"
								type="button"
							>
								<Plus size={10} />
								Pin a command
							</button>
						)}
					</div>
				)}
			</div>

			{/* Task Runner */}
			{tasks.length === 0 ? (
				<PanelEmptyState
					icon={<FileJson size={18} />}
					title="No scripts detected"
					description="Connexio looks for package.json, Makefile, Cargo.toml, and pyproject.toml commands."
				/>
			) : (
				<div>
					<button
						onClick={() => setShowTasks(!showTasks)}
						className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.035]"
						type="button"
					>
						{showTasks ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
						<Zap size={11} className="text-yellow-400" />
						<span className="section-label">Scripts</span>
						<span className="text-[9px] text-connexio-text-muted ml-auto">{tasks.length}</span>
					</button>

					{showTasks && (
						<div className="space-y-1 px-2 pb-2">
							{tasks.map((task) => (
								<button
									key={`${task.source}-${task.name}`}
									onClick={() => onRunCommand(task.command)}
									className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
									type="button"
									title={task.command}
								>
									<Play size={9} className="text-connexio-accent flex-shrink-0" />
									<span className="text-[11px] text-connexio-text truncate flex-1">
										{task.name}
									</span>
									<span className="rounded bg-white/[0.04] px-1 py-0.5 text-[8px] text-connexio-text-muted">
										{task.source.replace(".toml", "").replace(".json", "")}
									</span>
								</button>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function PanelEmptyState({
	icon,
	title,
	description,
	actionLabel,
	onAction,
}: {
	icon: React.ReactNode;
	title: string;
	description: string;
	actionLabel?: string;
	onAction?: () => void;
}) {
	return (
		<div className="mx-1 my-2 rounded-2xl soft-card px-3 py-4 text-center">
			<div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-connexio-accent/10 text-connexio-accent">
				{icon}
			</div>
			<p className="text-[11px] font-semibold text-connexio-text">{title}</p>
			<p className="mt-1 text-[10px] leading-4 text-connexio-text-muted">{description}</p>
			{actionLabel && onAction && (
				<button
					onClick={onAction}
					className="mt-3 rounded-lg bg-connexio-accent/10 px-2.5 py-1.5 text-[10px] font-semibold text-connexio-accent transition-colors hover:bg-connexio-accent/15"
					type="button"
				>
					{actionLabel}
				</button>
			)}
		</div>
	);
}

// ============================================
// Inline Edit/Add Form
// ============================================

function PinnedEditForm({
	label,
	command,
	onLabelChange,
	onCommandChange,
	onSave,
	onCancel,
	isNew,
}: {
	label: string;
	command: string;
	onLabelChange: (v: string) => void;
	onCommandChange: (v: string) => void;
	onSave: () => void;
	onCancel: () => void;
	isNew?: boolean;
}) {
	const labelRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		labelRef.current?.focus();
		if (!isNew) {
			labelRef.current?.select();
		}
	}, [isNew]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			onSave();
		}
		if (e.key === "Escape") {
			e.preventDefault();
			onCancel();
		}
	};

	return (
		<div className="space-y-1.5 rounded-lg bg-connexio-bg-tertiary/80 px-1.5 py-1.5">
			<input
				ref={labelRef}
				type="text"
				placeholder="Label (e.g. Start Dev)"
				value={label}
				onChange={(e) => onLabelChange(e.target.value)}
				onKeyDown={handleKeyDown}
				className="w-full rounded-md bg-connexio-bg px-2 py-1 text-[10px] text-connexio-text outline-none ring-1 ring-white/[0.04] focus:ring-connexio-accent/50"
			/>
			<input
				type="text"
				placeholder="Command (e.g. npm run dev)"
				value={command}
				onChange={(e) => onCommandChange(e.target.value)}
				onKeyDown={handleKeyDown}
				className="w-full rounded-md bg-connexio-bg px-2 py-1 text-[10px] text-connexio-text outline-none ring-1 ring-white/[0.04] focus:ring-connexio-accent/50 font-mono"
			/>
			<div className="flex gap-1">
				<button
					onClick={onSave}
					disabled={!label.trim() || !command.trim()}
					className="flex items-center gap-1 px-2 py-0.5 text-[9px] bg-connexio-accent text-white rounded hover:bg-connexio-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
					type="button"
				>
					<Check size={8} />
					{isNew ? "Add" : "Save"}
				</button>
				<button
					onClick={onCancel}
					className="flex items-center gap-1 px-2 py-0.5 text-[9px] text-connexio-text-muted hover:text-connexio-text transition-colors"
					type="button"
				>
					<X size={8} />
					Cancel
				</button>
			</div>
		</div>
	);
}
