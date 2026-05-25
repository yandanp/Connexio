import {
	Bookmark,
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
import type { PinnedCommand, TaskScript } from "../../shared/types";

interface Props {
	projectId: string;
	projectPath: string;
	onRunCommand: (command: string) => void;
}

export default function TaskPanel({
	projectId,
	projectPath,
	onRunCommand,
}: Props) {
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
			c.id === editingId
				? { ...c, label: newLabel.trim(), command: newCommand.trim() }
				: c,
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
		if (
			dragFromIndex !== null &&
			dragOverIndex !== null &&
			dragFromIndex !== dragOverIndex
		) {
			const reordered = [...pinnedCommands];
			const [moved] = reordered.splice(dragFromIndex, 1);
			reordered.splice(dragOverIndex, 0, moved);
			await savePinned(reordered);
		}
		setDragFromIndex(null);
		setDragOverIndex(null);
	};

	return (
		<div className="flex flex-col h-full overflow-y-auto">
			{/* Pinned Commands */}
			<div className="border-b border-connexio-border">
				<button
					onClick={() => setShowPinned(!showPinned)}
					className="flex items-center gap-1.5 w-full px-3 py-2 text-left hover:bg-connexio-bg-tertiary transition-colors"
					type="button"
				>
					{showPinned ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
					<Bookmark size={11} className="text-connexio-accent" />
					<span className="text-[10px] font-semibold text-connexio-text-secondary uppercase tracking-wider">
						Pinned
					</span>
					<span className="text-[9px] text-connexio-text-muted ml-auto">
						{pinnedCommands.length}
					</span>
				</button>

				{showPinned && (
					<div className="px-2 pb-2 space-y-0.5">
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
									className={`group flex items-center gap-1 px-1 py-1 rounded transition-colors select-none ${
										dragOverIndex === index
											? "bg-connexio-accent/15 border border-connexio-accent/40"
											: "hover:bg-connexio-bg-tertiary border border-transparent"
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
										<GripVertical
											size={9}
											className="text-connexio-text-muted"
										/>
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
											className="p-0.5 rounded hover:bg-connexio-bg transition-colors"
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
								className="flex items-center gap-1 px-2 py-1 text-[10px] text-connexio-text-muted hover:text-connexio-text transition-colors w-full"
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
			{tasks.length > 0 && (
				<div>
					<button
						onClick={() => setShowTasks(!showTasks)}
						className="flex items-center gap-1.5 w-full px-3 py-2 text-left hover:bg-connexio-bg-tertiary transition-colors"
						type="button"
					>
						{showTasks ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
						<Zap size={11} className="text-yellow-400" />
						<span className="text-[10px] font-semibold text-connexio-text-secondary uppercase tracking-wider">
							Scripts
						</span>
						<span className="text-[9px] text-connexio-text-muted ml-auto">
							{tasks.length}
						</span>
					</button>

					{showTasks && (
						<div className="px-2 pb-2 space-y-0.5">
							{tasks.map((task) => (
								<button
									key={`${task.source}-${task.name}`}
									onClick={() => onRunCommand(task.command)}
									className="flex items-center gap-1.5 w-full px-2 py-1 rounded hover:bg-connexio-bg-tertiary transition-colors text-left"
									type="button"
									title={task.command}
								>
									<Play
										size={9}
										className="text-connexio-accent flex-shrink-0"
									/>
									<span className="text-[11px] text-connexio-text truncate flex-1">
										{task.name}
									</span>
									<span className="text-[8px] text-connexio-text-muted px-1 py-0.5 rounded bg-connexio-bg">
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
		<div className="px-1.5 py-1.5 space-y-1.5 bg-connexio-bg-tertiary rounded border border-connexio-border">
			<input
				ref={labelRef}
				type="text"
				placeholder="Label (e.g. Start Dev)"
				value={label}
				onChange={(e) => onLabelChange(e.target.value)}
				onKeyDown={handleKeyDown}
				className="w-full px-2 py-1 text-[10px] bg-connexio-bg border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent"
			/>
			<input
				type="text"
				placeholder="Command (e.g. npm run dev)"
				value={command}
				onChange={(e) => onCommandChange(e.target.value)}
				onKeyDown={handleKeyDown}
				className="w-full px-2 py-1 text-[10px] bg-connexio-bg border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent font-mono"
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
