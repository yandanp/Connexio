import { GitBranch, Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { slugify } from "./slugify";

interface Props {
	projectPath: string;
	onClose: () => void;
}
export default function CreateWorktreeModal({ projectPath, onClose }: Props) {
	const [name, setName] = useState("");
	const [fromRef, setFromRef] = useState("HEAD");
	const [branchOverride, setBranchOverride] = useState("");
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState("");

	const branchPreview = useMemo(
		() => branchOverride.trim() || `connexio/${slugify(name)}`,
		[branchOverride, name],
	);

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = name.trim();
		if (!trimmed || creating) return;
		setCreating(true);
		setError("");
		try {
			await window.connexio.worktree.create(projectPath, trimmed, {
				fromRef: fromRef.trim() || "HEAD",
				branchOverride: branchOverride.trim() || undefined,
			});
			onClose();
		} catch (err) {
			setError(String(err));
			setCreating(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
			<div className="bg-connexio-bg-secondary border border-connexio-border rounded-lg w-[420px] shadow-2xl">
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-connexio-border">
					<h2 className="text-sm font-semibold text-connexio-text">Create Worktree</h2>
					<button onClick={onClose} className="dock-button p-1" type="button" aria-label="Close">
						<X size={14} className="text-connexio-text-secondary" />
					</button>
				</div>

				{/* Form */}
				<form onSubmit={handleCreate} className="p-4 space-y-4">
					<div>
						<label
							htmlFor="worktree-name"
							className="block text-xs font-medium text-connexio-text-secondary mb-1.5"
						>
							Name
						</label>
						<input
							id="worktree-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="feature/my-new-feature"
							autoFocus
							className="w-full bg-connexio-bg border border-connexio-border rounded-lg px-3 py-2 text-xs text-connexio-text focus:outline-none focus:border-connexio-accent"
						/>
					</div>

					<div>
						<label
							htmlFor="worktree-from"
							className="block text-xs font-medium text-connexio-text-secondary mb-1.5"
						>
							Start From
						</label>
						<input
							id="worktree-from"
							value={fromRef}
							onChange={(e) => setFromRef(e.target.value)}
							placeholder="HEAD (current checkout)"
							className="w-full bg-connexio-bg border border-connexio-border rounded-lg px-3 py-2 text-xs text-connexio-text focus:outline-none focus:border-connexio-accent"
						/>
					</div>

					<div>
						<label
							htmlFor="worktree-branch"
							className="block text-xs font-medium text-connexio-text-secondary mb-1.5"
						>
							Branch Name <span className="text-connexio-text-muted">(optional override)</span>
						</label>
						<input
							id="worktree-branch"
							value={branchOverride}
							onChange={(e) => setBranchOverride(e.target.value)}
							placeholder={branchPreview}
							className="w-full bg-connexio-bg border border-connexio-border rounded-lg px-3 py-2 text-xs text-connexio-text focus:outline-none focus:border-connexio-accent"
						/>
					</div>

					{/* Branch preview */}
					<div className="flex items-center gap-2 text-[11px] text-connexio-text-muted">
						<GitBranch size={12} />
						<span>
							Branch: <span className="text-connexio-accent font-mono">{branchPreview}</span>
						</span>
					</div>

					{error && (
						<p className="text-[11px] text-red-400 break-words" role="alert">
							{error}
						</p>
					)}

					{/* Actions */}
					<div className="flex justify-end gap-2 pt-2">
						<button
							type="button"
							onClick={onClose}
							className="px-4 py-1.5 text-xs font-medium text-connexio-text-secondary rounded-lg hover:bg-white/[0.04] transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={!name.trim() || creating}
							className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-white bg-connexio-accent rounded-lg hover:bg-connexio-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{creating && <Loader2 size={12} className="animate-spin" />}
							{creating ? "Creating..." : "Create Worktree"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
