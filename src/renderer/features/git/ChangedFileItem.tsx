import { Loader2, Maximize2, Minus, Plus, Undo2 } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import type { GitChangedFile, GitDiffResult } from "@shared/types";
import ConfirmDialog from "../../core/ui/ConfirmDialog";
import DiffViewer from "./DiffViewer";
import { cacheKey, diffCache, trimDiffCache } from "./git-diff-cache";
import { getFileDir, getFileName, getStatusLabel, type FileGroup } from "./git-file-grouping";
import { getStatusIcon } from "./git-file-status-icon";

export interface SourceMessage {
	type: "success" | "error" | "info";
	text: string;
}

interface FileItemProps {
	file: GitChangedFile;
	group: FileGroup;
	projectPath: string;
	isExpanded: boolean;
	onToggle: () => void;
	onRefresh: () => void;
	onMaximize: () => void;
	onMessage: (msg: SourceMessage) => void;
}

const ChangedFileItem = memo(function ChangedFileItem({
	file,
	group,
	projectPath,
	isExpanded,
	onToggle,
	onRefresh,
	onMaximize,
	onMessage,
}: FileItemProps) {
	const key = cacheKey(projectPath, group, file.path);
	const [diff, setDiff] = useState<GitDiffResult | null>(() => diffCache.get(key) ?? null);
	const [loading, setLoading] = useState(false);
	const [discardConfirm, setDiscardConfirm] = useState(false);
	const [actionLoading, setActionLoading] = useState(false);

	const status = group === "staged" ? file.indexStatus : file.workTreeStatus;
	const isDeleted = status === "D";

	const loadDiff = useCallback(async () => {
		// Hit cache first
		const cached = diffCache.get(key);
		if (cached) {
			setDiff(cached);
			return;
		}
		setLoading(true);
		try {
			let result: GitDiffResult;
			if (group === "untracked") {
				result = await window.connexio.git.diffUntracked(projectPath, file.path);
			} else {
				result = await window.connexio.git.diff(projectPath, file.path, group === "staged");
			}
			diffCache.set(key, result);
			trimDiffCache(projectPath);
			setDiff(result);
		} catch {
			setDiff(null);
		}
		setLoading(false);
	}, [file.path, group, projectPath, key]);

	// Auto-load when expanded (after mount or cache miss)
	useEffect(() => {
		if (isExpanded && !diff && !loading) {
			loadDiff();
		}
	}, [isExpanded, diff, loading, loadDiff]);

	const handleToggle = () => {
		onToggle();
	};

	const handleStage = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (actionLoading) return;
		setActionLoading(true);
		try {
			await window.connexio.git.stage(projectPath, file.path);
			onRefresh();
		} catch {
			onMessage({ type: "error", text: `Failed to stage ${getFileName(file.path)}` });
		}
		setActionLoading(false);
	};

	const handleUnstage = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (actionLoading) return;
		setActionLoading(true);
		try {
			await window.connexio.git.unstage(projectPath, file.path);
			onRefresh();
		} catch {
			onMessage({ type: "error", text: `Failed to unstage ${getFileName(file.path)}` });
		}
		setActionLoading(false);
	};

	const handleDiscard = async () => {
		setActionLoading(true);
		try {
			await window.connexio.git.discard(projectPath, file.path);
			setDiscardConfirm(false);
			onRefresh();
		} catch {
			onMessage({ type: "error", text: `Failed to discard ${getFileName(file.path)}` });
			setDiscardConfirm(false);
		}
		setActionLoading(false);
	};

	return (
		<>
			<div
				role="button"
				tabIndex={0}
				className={`group flex items-center gap-1 px-2 py-1 cursor-pointer transition-colors rounded mx-1 ${
					isExpanded ? "bg-connexio-bg-tertiary/80" : "hover:bg-white/[0.04]"
				}`}
				onClick={handleToggle}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						handleToggle();
					}
				}}
			>
				{getStatusIcon(status, group)}

				<div className="flex-1 min-w-0 flex items-baseline gap-0.5">
					<span
						className={`text-[11px] truncate ${
							isDeleted
								? "text-red-300/80 line-through decoration-red-400/70 decoration-1"
								: "text-connexio-text"
						}`}
					>
						{getFileName(file.path)}
					</span>
					{getFileDir(file.path) && (
						<span className="text-[9px] text-connexio-text-muted truncate">
							{getFileDir(file.path)}
						</span>
					)}
				</div>

				<span
					className={`text-[9px] font-mono px-1 rounded ${
						status === "M"
							? "text-yellow-400 bg-yellow-400/10"
							: status === "A" || group === "untracked"
								? "text-green-400 bg-green-400/10"
								: status === "D"
									? "text-red-400 bg-red-400/10"
									: "text-connexio-text-muted bg-connexio-bg-tertiary/80"
					}`}
					title={getStatusLabel(status)}
				>
					{group === "untracked" ? "U" : status}
				</span>

				<div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
					{actionLoading ? (
						<Loader2 size={10} className="text-connexio-text-muted animate-spin" />
					) : (
						<>
							<button
								onClick={(e) => {
									e.stopPropagation();
									onMaximize();
								}}
								className="p-0.5 rounded hover:bg-connexio-bg-primary transition-colors"
								title="Open full-screen diff viewer"
								type="button"
							>
								<Maximize2 size={10} className="text-connexio-accent" />
							</button>
							{group === "staged" ? (
								<button
									onClick={handleUnstage}
									className="p-0.5 rounded hover:bg-connexio-bg-primary transition-colors"
									title="Unstage"
									type="button"
								>
									<Minus size={10} className="text-yellow-400" />
								</button>
							) : (
								<>
									<button
										onClick={handleStage}
										className="p-0.5 rounded hover:bg-connexio-bg-primary transition-colors"
										title="Stage"
										type="button"
									>
										<Plus size={10} className="text-green-400" />
									</button>
									<button
										onClick={(e) => {
											e.stopPropagation();
											setDiscardConfirm(true);
										}}
										className="p-0.5 rounded hover:bg-connexio-bg-primary transition-colors"
										title="Discard changes"
										type="button"
									>
										<Undo2 size={10} className="text-red-400" />
									</button>
								</>
							)}
						</>
					)}
				</div>
			</div>

			{/* Expanded inline preview */}
			{isExpanded && (
				<div className="mx-1 mb-1 rounded-lg overflow-hidden bg-connexio-bg">
					{loading && !diff ? (
						<div className="px-3 py-2 text-[10px] text-connexio-text-muted flex items-center gap-1.5">
							<span className="animate-pulse">Loading diff...</span>
						</div>
					) : diff ? (
						<div className="max-h-[220px] overflow-auto">
							<DiffViewer
								diff={diff}
								view="unified"
								wrapLines={false}
								fontSize={10}
								maxLines={80}
								onRequestFullView={onMaximize}
							/>
						</div>
					) : (
						<div className="px-3 py-2 text-[10px] text-connexio-text-muted italic">
							Unable to load diff
						</div>
					)}
					{diff && !diff.isBinary && !diff.isTooLarge && diff.hunks.length > 0 && (
						<button
							onClick={onMaximize}
							className="w-full px-2 py-1 text-[10px] text-connexio-text-muted hover:text-connexio-accent hover:bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors flex items-center justify-center gap-1"
							type="button"
						>
							<Maximize2 size={9} />
							Open full-screen viewer
						</button>
					)}
				</div>
			)}

			{discardConfirm && (
				<ConfirmDialog
					title="Discard Changes"
					message={`Discard all changes to "${getFileName(file.path)}"? This cannot be undone.`}
					confirmLabel="Discard"
					cancelLabel="Cancel"
					variant="danger"
					onConfirm={handleDiscard}
					onCancel={() => setDiscardConfirm(false)}
				/>
			)}
		</>
	);
});

export default ChangedFileItem;
