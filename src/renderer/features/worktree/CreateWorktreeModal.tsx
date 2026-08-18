import { ChevronDown, GitBranch, Loader2, Search, Smile, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GitBranchEntry } from "../../../shared/types";
import { slugify } from "./slugify";

interface Props {
	projectPath: string;
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

export default function CreateWorktreeModal({ projectPath, onClose }: Props) {
	const [name, setName] = useState("");
	const [fromRef, setFromRef] = useState("HEAD");
	const [branchOverride, setBranchOverride] = useState("");
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState("");

	// Start-from picker state
	const [branches, setBranches] = useState<GitBranchEntry[] | null>(null);
	const [showFromPicker, setShowFromPicker] = useState(false);
	const [fromQuery, setFromQuery] = useState("");
	const fromRefInput = useRef<HTMLInputElement>(null);

	// Emoji picker state
	const [showEmoji, setShowEmoji] = useState(false);

	// Load branches once for the start-from picker.
	useEffect(() => {
		window.connexio.git
			.branches(projectPath)
			.then(setBranches)
			.catch(() => setBranches([]));
	}, [projectPath]);

	const branchPreview = useMemo(
		() => branchOverride.trim() || `connexio/${slugify(name)}`,
		[branchOverride, name],
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

	const filteredBranches = useMemo(() => {
		if (!branches) return [];
		const q = fromQuery.trim().toLowerCase();
		return q ? branches.filter((b) => b.name.toLowerCase().includes(q)) : branches;
	}, [branches, fromQuery]);

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
					{/* Name with emoji picker */}
					<div>
						<label
							htmlFor="worktree-name"
							className="block text-xs font-medium text-connexio-text-secondary mb-1.5"
						>
							Name
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
						<div className="relative">
							<button
								type="button"
								id="worktree-from"
								onClick={() => setShowFromPicker((v) => !v)}
								className="flex w-full items-center gap-2 rounded-lg border border-connexio-border bg-connexio-bg px-3 py-2 text-left text-xs text-connexio-text hover:border-connexio-accent/50 transition-colors"
							>
								<GitBranch size={12} className="flex-shrink-0 text-connexio-text-muted" />
								<span className="flex-1 truncate font-mono">{fromRef}</span>
								<ChevronDown size={12} className="flex-shrink-0 text-connexio-text-muted" />
							</button>

							{showFromPicker && (
								<div className="absolute top-9 left-0 z-10 w-full rounded-lg border border-connexio-border bg-connexio-bg-secondary shadow-2xl">
									<div className="flex items-center gap-1.5 border-b border-connexio-border px-2.5 py-1.5">
										<Search size={11} className="text-connexio-text-muted" />
										<input
											ref={fromRefInput}
											value={fromQuery}
											onChange={(e) => setFromQuery(e.target.value)}
											placeholder="Filter branches or type a ref…"
											className="w-full bg-transparent text-[11px] text-connexio-text outline-none placeholder:text-connexio-text-muted"
										/>
									</div>
									<div className="max-h-44 overflow-y-auto p-1">
										<button
											type="button"
											onClick={() => {
												setFromRef("HEAD");
												setShowFromPicker(false);
											}}
											className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] hover:bg-connexio-bg-tertiary/60"
										>
											<span className="font-mono text-connexio-accent">HEAD</span>
											<span className="text-connexio-text-muted">(current checkout)</span>
										</button>
										{branches === null && (
											<div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-connexio-text-muted">
												<Loader2 size={10} className="animate-spin" /> Loading…
											</div>
										)}
										{filteredBranches.map((b) => (
											<button
												key={b.name}
												type="button"
												onClick={() => {
													setFromRef(b.name);
													setShowFromPicker(false);
												}}
												className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] hover:bg-connexio-bg-tertiary/60"
											>
												<span className="truncate font-mono text-connexio-text-secondary">
													{b.name}
												</span>
												{b.current && (
													<span className="ml-auto flex-shrink-0 text-[9px] uppercase tracking-wide text-connexio-accent">
														current
													</span>
												)}
												{b.remote && (
													<span className="ml-auto flex-shrink-0 text-[9px] uppercase tracking-wide text-connexio-text-muted">
														remote
													</span>
												)}
											</button>
										))}
										{/* Custom ref entry — free-form SHA/ref */}
										{fromQuery.trim() && (
											<button
												type="button"
												onClick={() => {
													setFromRef(fromQuery.trim());
													setShowFromPicker(false);
												}}
												className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] hover:bg-connexio-bg-tertiary/60"
											>
												<span className="text-connexio-text-muted">Use ref:</span>
												<span className="truncate font-mono text-connexio-accent">
													{fromQuery.trim()}
												</span>
											</button>
										)}
									</div>
								</div>
							)}
						</div>
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
