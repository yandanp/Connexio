import { GitBranch, Loader2, Smile, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { GitBranchEntry } from "../../../shared/types";
import FromRefPicker from "./FromRefPicker";
import { slugify } from "./slugify";

interface Props {
	projectPath: string;
	/** Parent project id — the worktree terminal opens as its tab. */
	projectId: string;
	onClose: () => void;
}
/** Orca-style shortcode map — typing `:ro` suggests :rocket:. */
const EMOJI_SHORTCODES: Record<string, string> = {
	":rocket:": "🚀",
	":bug:": "🐛",
	":sparkles:": "✨",
	":fire:": "🔥",
	":zap:": "⚡",
	":wrench:": "🔧",
	":art:": "🎨",
	":memo:": "📝",
	":white_check_mark:": "✅",
	":lock:": "🔒",
	":tada:": "🎉",
	":star:": "⭐",
};
export default function CreateWorktreeModal({ projectPath, projectId, onClose }: Props) {
	const [name, setName] = useState("");
	// fromRef starts null and adopts the workflow default once settings load.
	const [fromRef, setFromRef] = useState<string | null>(null);
	const [branchPrefix, setBranchPrefix] = useState("connexio");
	const [branchOverride, setBranchOverride] = useState("");
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState("");

	// Start-from picker branches (loaded once, passed to FromRefPicker)
	const [branches, setBranches] = useState<GitBranchEntry[] | null>(null);

	// Emoji picker state
	const [showEmoji, setShowEmoji] = useState(false);

	const branchPreview = useMemo(
		() => branchOverride.trim() || `${branchPrefix}/${slugify(name)}`,
		[branchOverride, branchPrefix, name],
	);

	// Suggest shortcodes matching a partially typed `:word` fragment.
	const shortcodeSuggestions = useMemo(() => {
		const match = name.match(/:[a-z_]*$/i);
		if (!match) return [];
		const partial = match[0].toLowerCase();
		return Object.entries(EMOJI_SHORTCODES)
			.filter(([code]) => code.startsWith(partial) && code !== partial)
			.slice(0, 6);
	}, [name]);

	const insertEmoji = (shortcode: string, emoji: string) => {
		setName((n) => n.replace(/:[a-z_]*$/i, `${emoji} `));
		setShowEmoji(false);
	};

	// Load branches once for the start-from picker.
	useEffect(() => {
		window.connexio.git
			.branches(projectPath)
			.then(setBranches)
			.catch(() => setBranches([]));
	}, [projectPath]);

	// Load workflow settings (branch prefix, default base ref) for previews.
	useEffect(() => {
		window.connexio.settings
			.get()
			.then((s) => {
				setBranchPrefix(s.branchPrefix?.trim() || "connexio");
				if (!fromRef) setFromRef(s.defaultBaseRef?.trim() || "HEAD");
			})
			.catch(() => {});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = name.trim();
		if (!trimmed || creating) return;
		setCreating(true);
		try {
			const entry = await window.connexio.worktree.create(projectPath, trimmed, {
				fromRef: fromRef?.trim() || undefined,
				branchOverride: branchOverride.trim() || undefined,
			});
			// Open a terminal scoped to the new worktree right away — as a tab
			// of the parent project, matching Orca's instant-open flow.
			const wsMod = await import("../workspace/workspace-store");
			await wsMod.useWorkspaceStore
				.getState()
				.openTerminalTab(projectId, entry.name, undefined, { cwd: entry.path });
			// Let sidebar lists (this project's and any others) refresh.
			window.dispatchEvent(new CustomEvent("connexio:worktree-changed"));
			onClose();
		} catch (err) {
			setError(String(err));
			setCreating(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
			<div className="bg-connexio-bg-secondary border border-connexio-border rounded-lg w-[440px] shadow-2xl max-h-[90vh] overflow-y-auto">
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-connexio-border">
					<h2 className="text-sm font-semibold text-connexio-text">Create Worktree</h2>
					<button onClick={onClose} className="dock-button p-1" type="button" aria-label="Close">
						<X size={14} className="text-connexio-text-secondary" />
					</button>
				</div>

				{/* Form */}
				<form onSubmit={handleCreate} className="p-4 space-y-4">
					{/* Name — first field, Orca asks this as the primary question */}
					<div>
						<label
							htmlFor="worktree-name"
							className="block text-xs font-medium text-connexio-text-secondary mb-1.5"
						>
							Task Name
						</label>
						<div className="relative flex gap-1.5">
							<input
								id="worktree-name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder=":rocket: login flow"
								autoFocus
								className="w-full bg-connexio-bg border border-connexio-border rounded-lg px-3 py-2 text-xs text-connexio-text focus:outline-none focus:border-connexio-accent"
							/>
							<button
								type="button"
								onClick={() => setShowEmoji((v) => !v)}
								className={`flex-shrink-0 rounded-lg border px-2 transition-colors ${
									showEmoji
										? "border-connexio-accent text-connexio-accent"
										: "border-connexio-border text-connexio-text-muted hover:text-connexio-text-secondary"
								}`}
								title="Insert emoji"
							>
								<Smile size={14} />
							</button>

							{showEmoji && (
								<div className="absolute top-9 right-0 z-10 w-56 rounded-lg border border-connexio-border bg-connexio-bg-secondary p-1.5 shadow-2xl">
									<div className="grid grid-cols-6 gap-0.5">
										{Object.entries(EMOJI_SHORTCODES).map(([code, emoji]) => (
											<button
												key={code}
												type="button"
												title={code}
												onClick={() => insertEmoji(code, emoji)}
												className="rounded p-1 text-sm hover:bg-connexio-bg-tertiary"
											>
												{emoji}
											</button>
										))}
									</div>
									<p className="px-1 pt-1 text-[9px] text-connexio-text-muted">
										Tip: type <span className="font-mono">:rocket</span> in the name field
									</p>
								</div>
							)}
						</div>

						{/* Inline shortcode suggestions while typing :word */}
						{shortcodeSuggestions.length > 0 && (
							<div className="mt-1 flex flex-wrap gap-1">
								{shortcodeSuggestions.map(([code, emoji]) => (
									<button
										key={code}
										type="button"
										onClick={() => insertEmoji(code, emoji)}
										className="rounded-md bg-connexio-bg-tertiary/60 px-1.5 py-0.5 text-[10px] text-connexio-text-secondary hover:bg-connexio-accent/15 hover:text-connexio-accent"
									>
										{emoji} {code}
									</button>
								))}
							</div>
						)}
					</div>

					{/* Start-from picker */}
					<div>
						<label
							htmlFor="worktree-from"
							className="block text-xs font-medium text-connexio-text-secondary mb-1.5"
						>
							Start From
						</label>
						<FromRefPicker
							branches={branches}
							fromRef={fromRef}
							onSelect={(ref) => setFromRef(ref === "" ? null : ref)}
						/>
					</div>

					{/* Branch override */}
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
							placeholder=" "
							className="w-full bg-connexio-bg border border-connexio-border rounded-lg px-3 py-2 text-xs text-connexio-text focus:outline-none focus:border-connexio-accent"
						/>
					</div>

					{/* Branch preview */}
					{branchOverride.trim() && (
						<div className="flex items-center gap-2 text-[11px] text-connexio-text-muted">
							<GitBranch size={12} />
							<span>
								Branch: <span className="text-connexio-accent font-mono">{branchPreview}</span>
							</span>
						</div>
					)}

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
