import { FolderOpen, X } from "lucide-react";
import { useState } from "react";
import { useProjectStore } from "../stores/projectStore";

interface Props {
	onClose: () => void;
}

export default function AddProjectModal({ onClose }: Props) {
	const { addProject } = useProjectStore();
	const [name, setName] = useState("");
	const [path, setPath] = useState("");
	const [group, setGroup] = useState("default");

	const handleSelectDir = async () => {
		const dir = await window.connexio.project.selectDir();
		if (dir) {
			setPath(dir);
			if (!name) {
				// Auto-fill name from folder name
				const parts = dir.replace(/\\/g, "/").split("/");
				setName(parts[parts.length - 1] || "");
			}
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name || !path) return;
		await addProject(name, path, group);
		onClose();
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
			<div className="bg-connexio-bg-secondary border border-connexio-border rounded-lg w-[420px] shadow-2xl">
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-connexio-border">
					<h2 className="text-sm font-semibold text-connexio-text">
						Add Project
					</h2>
					<button
						onClick={onClose}
						className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
						type="button"
					>
						<X size={14} className="text-connexio-text-secondary" />
					</button>
				</div>

				{/* Form */}
				<form onSubmit={handleSubmit} className="p-4 space-y-4">
					{/* Name */}
					<div>
						<label className="block text-xs font-medium text-connexio-text-secondary mb-1.5">
							Project Name
						</label>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="My Awesome Project"
							className="w-full px-3 py-2 text-sm bg-connexio-bg-tertiary border border-connexio-border rounded text-connexio-text placeholder:text-connexio-text-muted outline-none focus:border-connexio-accent transition-colors"
						/>
					</div>

					{/* Path */}
					<div>
						<label className="block text-xs font-medium text-connexio-text-secondary mb-1.5">
							Project Path
						</label>
						<div className="flex gap-2">
							<input
								type="text"
								value={path}
								onChange={(e) => setPath(e.target.value)}
								placeholder="C:\Users\you\projects\myapp"
								className="flex-1 px-3 py-2 text-sm bg-connexio-bg-tertiary border border-connexio-border rounded text-connexio-text placeholder:text-connexio-text-muted outline-none focus:border-connexio-accent transition-colors"
							/>
							<button
								type="button"
								onClick={handleSelectDir}
								className="px-3 py-2 bg-connexio-bg-tertiary border border-connexio-border rounded hover:bg-connexio-accent/10 hover:border-connexio-accent/30 transition-colors"
							>
								<FolderOpen
									size={14}
									className="text-connexio-text-secondary"
								/>
							</button>
						</div>
					</div>

					{/* Group */}
					<div>
						<label className="block text-xs font-medium text-connexio-text-secondary mb-1.5">
							Group
						</label>
						<input
							type="text"
							value={group}
							onChange={(e) => setGroup(e.target.value)}
							placeholder="work, personal, etc."
							className="w-full px-3 py-2 text-sm bg-connexio-bg-tertiary border border-connexio-border rounded text-connexio-text placeholder:text-connexio-text-muted outline-none focus:border-connexio-accent transition-colors"
						/>
					</div>

					{/* Actions */}
					<div className="flex justify-end gap-2 pt-2">
						<button
							type="button"
							onClick={onClose}
							className="px-4 py-2 text-xs font-medium text-connexio-text-secondary bg-connexio-bg-tertiary border border-connexio-border rounded hover:bg-connexio-bg transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={!name || !path}
							className="px-4 py-2 text-xs font-medium text-white bg-connexio-accent rounded hover:bg-connexio-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Add Project
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
