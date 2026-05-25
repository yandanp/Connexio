import {
	Check,
	GitBranch,
	Globe,
	Loader2,
	Plus,
	Search,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GitActionResult, GitBranchEntry } from "../../../shared/types";

interface Props {
	projectPath: string;
	currentBranch: string;
	onClose: () => void;
	onMessage: (msg: { type: "success" | "error" | "info"; text: string }) => void;
	onBranchChanged: () => void;
}

export default function BranchPicker({
	projectPath,
	currentBranch,
	onClose,
	onMessage,
	onBranchChanged,
}: Props) {
	const [branches, setBranches] = useState<GitBranchEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [switching, setSwitching] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [showCreate, setShowCreate] = useState(false);
	const [newBranchName, setNewBranchName] = useState("");
	const [creating, setCreating] = useState(false);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);

	const fetchBranches = useCallback(async () => {
		setLoading(true);
		try {
			const result = await window.connexio.git.branches(projectPath);
			setBranches(result);
		} catch {
			setBranches([]);
		}
		setLoading(false);
	}, [projectPath]);

	useEffect(() => {
		fetchBranches();
		setTimeout(() => searchInputRef.current?.focus(), 100);
	}, [fetchBranches]);

	// Close on outside click
	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
				onClose();
			}
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [onClose]);

	// Close on Escape
	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [onClose]);

	const handleCheckout = useCallback(
		async (branch: string) => {
			if (switching) return;
			// Don't switch to current branch
			if (branch === currentBranch) return;

			setSwitching(branch);
			try {
				const result: GitActionResult =
					await window.connexio.git.checkout(projectPath, branch);
				if (result.success) {
					onMessage({ type: "success", text: result.message });
					onBranchChanged();
					onClose();
				} else {
					onMessage({ type: "error", text: result.message });
				}
			} catch {
				onMessage({ type: "error", text: "Switch branch failed" });
			}
			setSwitching(null);
		},
		[switching, currentBranch, projectPath, onMessage, onBranchChanged, onClose],
	);

	const handleCreateBranch = useCallback(async () => {
		if (creating || !newBranchName.trim()) return;
		setCreating(true);
		try {
			const result: GitActionResult =
				await window.connexio.git.createBranch(projectPath, newBranchName.trim());
			if (result.success) {
				onMessage({ type: "success", text: result.message });
				onBranchChanged();
				onClose();
			} else {
				onMessage({ type: "error", text: result.message });
			}
		} catch {
			onMessage({ type: "error", text: "Create branch failed" });
		}
		setCreating(false);
	}, [creating, newBranchName, projectPath, onMessage, onBranchChanged, onClose]);

	const localBranches = branches.filter((b) => !b.remote);
	const remoteBranches = branches.filter((b) => b.remote);

	const filteredLocal = searchQuery
		? localBranches.filter((b) =>
				b.name.toLowerCase().includes(searchQuery.toLowerCase()),
			)
		: localBranches;

	const filteredRemote = searchQuery
		? remoteBranches.filter((b) =>
				b.name.toLowerCase().includes(searchQuery.toLowerCase()),
			)
		: remoteBranches;

	return (
		<div
			ref={panelRef}
			className="absolute left-0 right-0 top-full mt-1 z-50 bg-connexio-bg-secondary border border-connexio-border rounded-lg shadow-xl overflow-hidden max-h-[320px] flex flex-col"
		>
			{/* Search */}
			<div className="flex items-center gap-1.5 px-3 py-2 border-b border-connexio-border">
				<Search size={11} className="text-connexio-text-muted flex-shrink-0" />
				<input
					ref={searchInputRef}
					type="text"
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					placeholder="Search branches..."
					className="flex-1 bg-transparent text-[11px] text-connexio-text outline-none placeholder:text-connexio-text-muted/60"
					onKeyDown={(e) => {
						if (e.key === "Escape") onClose();
					}}
				/>
				<button
					onClick={onClose}
					className="p-0.5 rounded hover:bg-connexio-bg-tertiary transition-colors"
					type="button"
				>
					<X size={11} className="text-connexio-text-muted" />
				</button>
			</div>

			{/* Branch list */}
			<div className="flex-1 overflow-y-auto">
				{loading ? (
					<div className="flex items-center justify-center py-6 gap-2 text-connexio-text-muted">
						<Loader2 size={12} className="animate-spin" />
						<span className="text-[10px]">Loading branches...</span>
					</div>
				) : (
					<>
						{/* Local branches */}
						{filteredLocal.length > 0 && (
							<div className="py-1">
								<div className="px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-connexio-text-muted">
									Local
								</div>
								{filteredLocal.map((branch) => (
									<button
										key={`local-${branch.name}`}
										onClick={() => handleCheckout(branch.name)}
										disabled={branch.current || switching !== null}
										className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors text-left ${
											branch.current
												? "text-connexio-accent bg-connexio-accent/5"
												: "text-connexio-text hover:bg-connexio-bg-tertiary"
										} ${switching === branch.name ? "opacity-60" : ""}`}
										type="button"
									>
										{branch.current ? (
											<Check size={10} className="text-connexio-accent flex-shrink-0" />
										) : switching === branch.name ? (
											<Loader2 size={10} className="animate-spin flex-shrink-0 text-connexio-text-muted" />
										) : (
											<GitBranch size={10} className="text-connexio-text-muted flex-shrink-0" />
										)}
										<span className="truncate">{branch.name}</span>
									</button>
								))}
							</div>
						)}

						{/* Remote branches */}
						{filteredRemote.length > 0 && (
							<div className="py-1 border-t border-connexio-border/50">
								<div className="px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-connexio-text-muted">
									Remote
								</div>
								{filteredRemote.map((branch) => (
									<button
										key={`remote-${branch.name}`}
										onClick={() => handleCheckout(branch.name)}
										disabled={switching !== null}
										className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-connexio-text hover:bg-connexio-bg-tertiary transition-colors text-left ${
											switching === branch.name ? "opacity-60" : ""
										}`}
										type="button"
									>
										{switching === branch.name ? (
											<Loader2 size={10} className="animate-spin flex-shrink-0 text-connexio-text-muted" />
										) : (
											<Globe size={10} className="text-connexio-text-muted flex-shrink-0" />
										)}
										<span className="truncate">{branch.name}</span>
									</button>
								))}
							</div>
						)}

						{filteredLocal.length === 0 && filteredRemote.length === 0 && (
							<div className="py-4 text-center text-[10px] text-connexio-text-muted">
								No branches match "{searchQuery}"
							</div>
						)}
					</>
				)}
			</div>

			{/* Create branch */}
			<div className="border-t border-connexio-border">
				{showCreate ? (
					<div className="flex items-center gap-1.5 px-3 py-2">
						<input
							type="text"
							value={newBranchName}
							onChange={(e) => setNewBranchName(e.target.value)}
							placeholder="New branch name..."
							className="flex-1 bg-connexio-bg-tertiary border border-connexio-border rounded px-2 py-1 text-[11px] text-connexio-text outline-none focus:border-connexio-accent/50"
							onKeyDown={(e) => {
								if (e.key === "Enter") handleCreateBranch();
								if (e.key === "Escape") {
									setShowCreate(false);
									setNewBranchName("");
								}
							}}
							autoFocus
						/>
						<button
							onClick={handleCreateBranch}
							disabled={creating || !newBranchName.trim()}
							className="px-2 py-1 text-[10px] font-medium rounded border border-green-400/40 text-green-400 hover:bg-green-400/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
							type="button"
						>
							{creating ? (
								<Loader2 size={10} className="animate-spin" />
							) : (
								"Create"
							)}
						</button>
						<button
							onClick={() => {
								setShowCreate(false);
								setNewBranchName("");
							}}
							className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
							type="button"
						>
							<X size={10} className="text-connexio-text-muted" />
						</button>
					</div>
				) : (
					<button
						onClick={() => setShowCreate(true)}
						className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-connexio-text-muted hover:text-connexio-accent hover:bg-connexio-bg-tertiary transition-colors"
						type="button"
					>
						<Plus size={11} />
						Create Branch
					</button>
				)}
			</div>
		</div>
	);
}
