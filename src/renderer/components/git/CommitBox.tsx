import {
	ArrowDown,
	ArrowUp,
	Archive,
	GitCommit,
	Loader2,
	MoreHorizontal,
	RefreshCw,
	Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GitActionResult } from "../../../shared/types";

interface Props {
	projectPath: string;
	stagedCount: number;
	hasUncommittedChanges: boolean;
	hasUpstream: boolean;
	onMessage: (msg: { type: "success" | "error" | "info"; text: string }) => void;
	onRefresh: () => void;
}

export default function CommitBox({
	projectPath,
	stagedCount,
	hasUncommittedChanges,
	hasUpstream,
	onMessage,
	onRefresh,
}: Props) {
	const [commitMessage, setCommitMessage] = useState("");
	const [isCommitting, setIsCommitting] = useState(false);
	const [isPushing, setIsPushing] = useState(false);
	const [isFetching, setIsFetching] = useState(false);
	const [isPulling, setIsPulling] = useState(false);
	const [showMenu, setShowMenu] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	const canCommit =
		stagedCount > 0 &&
		commitMessage.trim().length > 0 &&
		!isCommitting &&
		!isPushing;
	const isBusy = isCommitting || isPushing || isFetching || isPulling;

	// Close menu on outside click
	useEffect(() => {
		if (!showMenu) return;
		const handleClick = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setShowMenu(false);
			}
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [showMenu]);

	const handleCommit = useCallback(async () => {
		if (!canCommit) return;
		setIsCommitting(true);
		try {
			const result: GitActionResult = await window.connexio.git.commit(
				projectPath,
				commitMessage.trim(),
			);
			if (result.success) {
				onMessage({ type: "success", text: result.message });
				setCommitMessage("");
				onRefresh();
			} else {
				onMessage({ type: "error", text: result.message });
			}
		} catch {
			onMessage({ type: "error", text: "Commit failed unexpectedly" });
		}
		setIsCommitting(false);
	}, [canCommit, projectPath, commitMessage, onMessage, onRefresh]);

	const handleCommitAndPush = useCallback(async () => {
		if (!canCommit) return;
		setIsCommitting(true);
		try {
			const commitResult: GitActionResult = await window.connexio.git.commit(
				projectPath,
				commitMessage.trim(),
			);
			if (!commitResult.success) {
				onMessage({ type: "error", text: commitResult.message });
				setIsCommitting(false);
				return;
			}
			setIsCommitting(false);
			setIsPushing(true);
			const pushResult: GitActionResult =
				await window.connexio.git.push(projectPath);
			if (pushResult.success) {
				onMessage({ type: "success", text: "Committed and pushed" });
				setCommitMessage("");
				onRefresh();
			} else {
				onMessage({ type: "error", text: pushResult.message });
				onRefresh();
			}
		} catch {
			onMessage({ type: "error", text: "Commit & push failed unexpectedly" });
		}
		setIsCommitting(false);
		setIsPushing(false);
	}, [canCommit, projectPath, commitMessage, onMessage, onRefresh]);

	const handlePush = useCallback(async () => {
		if (isBusy) return;
		setIsPushing(true);
		try {
			const result: GitActionResult =
				await window.connexio.git.push(projectPath);
			if (result.success) {
				onMessage({ type: "success", text: result.message });
				onRefresh();
			} else {
				onMessage({ type: "error", text: result.message });
			}
		} catch {
			onMessage({ type: "error", text: "Push failed unexpectedly" });
		}
		setIsPushing(false);
	}, [isBusy, projectPath, onMessage, onRefresh]);

	const handleFetch = useCallback(async () => {
		if (isBusy) return;
		setIsFetching(true);
		setShowMenu(false);
		try {
			const result: GitActionResult =
				await window.connexio.git.fetch(projectPath);
			if (result.success) {
				onMessage({ type: "success", text: result.message });
				onRefresh();
			} else {
				onMessage({ type: "error", text: result.message });
			}
		} catch {
			onMessage({ type: "error", text: "Fetch failed unexpectedly" });
		}
		setIsFetching(false);
	}, [isBusy, projectPath, onMessage, onRefresh]);

	const handlePull = useCallback(async () => {
		if (isBusy) return;
		setIsPulling(true);
		setShowMenu(false);
		try {
			const result: GitActionResult =
				await window.connexio.git.pull(projectPath);
			if (result.success) {
				onMessage({ type: "success", text: result.message });
				onRefresh();
			} else {
				onMessage({ type: "error", text: result.message });
			}
		} catch {
			onMessage({ type: "error", text: "Pull failed unexpectedly" });
		}
		setIsPulling(false);
	}, [isBusy, projectPath, onMessage, onRefresh]);

	const handlePublish = useCallback(async () => {
		if (isBusy) return;
		setIsPushing(true);
		setShowMenu(false);
		try {
			const result: GitActionResult =
				await window.connexio.git.publishBranch(projectPath);
			if (result.success) {
				onMessage({ type: "success", text: result.message });
				onRefresh();
			} else {
				onMessage({ type: "error", text: result.message });
			}
		} catch {
			onMessage({ type: "error", text: "Publish failed unexpectedly" });
		}
		setIsPushing(false);
	}, [isBusy, projectPath, onMessage, onRefresh]);

	const handleStash = useCallback(async () => {
		if (isBusy) return;
		setShowMenu(false);
		try {
			const result: GitActionResult =
				await window.connexio.git.stashSave(projectPath);
			if (result.success) {
				onMessage({ type: "success", text: result.message });
				onRefresh();
			} else {
				onMessage({ type: "error", text: result.message });
			}
		} catch {
			onMessage({ type: "error", text: "Stash failed unexpectedly" });
		}
	}, [isBusy, projectPath, onMessage, onRefresh]);

	const handleStashPop = useCallback(async () => {
		if (isBusy) return;
		setShowMenu(false);
		try {
			const result: GitActionResult =
				await window.connexio.git.stashPop(projectPath);
			if (result.success) {
				onMessage({ type: "success", text: result.message });
				onRefresh();
			} else {
				onMessage({ type: "error", text: result.message });
			}
		} catch {
			onMessage({ type: "error", text: "Stash pop failed unexpectedly" });
		}
	}, [isBusy, projectPath, onMessage, onRefresh]);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
			e.preventDefault();
			handleCommit();
		}
	};

	return (
		<div className="px-3 py-2 border-b border-connexio-border space-y-2 relative overflow-visible">
			{/* Commit message */}
			<textarea
				value={commitMessage}
				onChange={(e) => setCommitMessage(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={
					stagedCount > 0
						? "Commit message (Ctrl+Enter to commit)"
						: "Stage changes before committing"
				}
				className="w-full bg-connexio-bg-tertiary border border-connexio-border rounded px-2 py-1.5 text-[11px] text-connexio-text placeholder:text-connexio-text-muted/50 outline-none focus:border-connexio-accent/50 resize-none transition-colors"
				rows={2}
				disabled={isBusy}
			/>

			{/* Action buttons */}
			<div className="flex items-center gap-1.5">
				<button
					onClick={handleCommit}
					disabled={!canCommit}
					className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border border-connexio-accent/40 text-connexio-accent hover:bg-connexio-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
					title={
						stagedCount === 0
							? "No staged changes"
							: !commitMessage.trim()
								? "Enter a commit message"
								: "Commit staged changes (Ctrl+Enter)"
					}
					type="button"
				>
					{isCommitting ? (
						<Loader2 size={10} className="animate-spin" />
					) : (
						<GitCommit size={10} />
					)}
					Commit
				</button>

				<button
					onClick={handleCommitAndPush}
					disabled={!canCommit}
					className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded border border-green-400/40 text-green-400 hover:bg-green-400/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
					title="Commit and push"
					type="button"
				>
					{isCommitting || isPushing ? (
						<Loader2 size={10} className="animate-spin" />
					) : (
						<>
							<GitCommit size={9} />
							<ArrowUp size={9} />
						</>
					)}
					Commit & Push
				</button>

				{/* More actions menu */}
				<div className="relative ml-auto" ref={menuRef}>
					<button
						onClick={() => setShowMenu(!showMenu)}
						disabled={isBusy}
						className="flex items-center gap-1 px-1.5 py-1 text-[10px] rounded border border-connexio-border text-connexio-text-muted hover:border-connexio-text-muted/50 hover:text-connexio-text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
						title="More actions"
						type="button"
					>
						{isFetching || isPulling ? (
							<Loader2 size={10} className="animate-spin" />
						) : (
							<MoreHorizontal size={12} />
						)}
					</button>

					{showMenu && (
						<div className="absolute right-0 top-full mt-1 z-50 w-44 bg-connexio-bg-secondary border border-connexio-border rounded-md shadow-lg overflow-hidden">
							<button
								onClick={handleFetch}
								className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-connexio-text hover:bg-connexio-bg-tertiary transition-colors text-left"
								type="button"
							>
								<RefreshCw size={11} className="text-connexio-text-muted" />
								Fetch
							</button>
							<button
								onClick={handlePull}
								className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-connexio-text hover:bg-connexio-bg-tertiary transition-colors text-left"
								type="button"
							>
								<ArrowDown size={11} className="text-connexio-text-muted" />
								Pull
								{hasUncommittedChanges && (
									<span className="ml-auto text-[9px] text-yellow-400">!</span>
								)}
							</button>
							<button
								onClick={handlePush}
								className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-connexio-text hover:bg-connexio-bg-tertiary transition-colors text-left"
								type="button"
							>
								<ArrowUp size={11} className="text-connexio-text-muted" />
								Push
							</button>
							{!hasUpstream && (
								<button
									onClick={handlePublish}
									className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-connexio-text hover:bg-connexio-bg-tertiary transition-colors text-left"
									type="button"
								>
									<Upload size={11} className="text-connexio-text-muted" />
									Publish Branch
								</button>
							)}
							<div className="border-t border-connexio-border/50 my-0.5" />
							<button
								onClick={handleStash}
								className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-connexio-text hover:bg-connexio-bg-tertiary transition-colors text-left"
								type="button"
							>
								<Archive size={11} className="text-connexio-text-muted" />
								Stash Changes
							</button>
							<button
								onClick={handleStashPop}
								className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-connexio-text hover:bg-connexio-bg-tertiary transition-colors text-left"
								type="button"
							>
								<Archive size={11} className="text-connexio-accent" />
								Pop Stash
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
