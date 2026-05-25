import {
	AlertCircle,
	ArrowDown,
	ArrowUp,
	ChevronDown,
	GitBranch,
	GitCommit,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GitStatus } from "../../shared/types";
import BranchPicker from "./git/BranchPicker";

interface Props {
	projectPath: string;
	onMessage?: (msg: { type: "success" | "error" | "info"; text: string }) => void;
	onRefresh?: () => void;
}

export default function GitStatusBar({ projectPath, onMessage, onRefresh }: Props) {
	const [status, setStatus] = useState<GitStatus | null>(null);
	const [showBranchPicker, setShowBranchPicker] = useState(false);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const mountedRef = useRef(false);
	const activeProjectPathRef = useRef(projectPath);

	const fetchStatus = useCallback(async () => {
		const targetPath = projectPath;
		try {
			const result = await window.connexio.git.status(targetPath);
			if (mountedRef.current && activeProjectPathRef.current === targetPath) {
				setStatus(result);
			}
		} catch {
			if (mountedRef.current && activeProjectPathRef.current === targetPath) {
				setStatus(null);
			}
		}
	}, [projectPath]);

	useEffect(() => {
		mountedRef.current = true;
		activeProjectPathRef.current = projectPath;
		setStatus(null);
		fetchStatus();

		const startPolling = () => {
			if (intervalRef.current) return;
			intervalRef.current = setInterval(fetchStatus, 60000);
		};
		const stopPolling = () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};

		startPolling();

		const onVisibilityChange = () => {
			if (document.hidden) {
				stopPolling();
			} else {
				fetchStatus();
				startPolling();
			}
		};
		const onFocus = () => fetchStatus();

		document.addEventListener("visibilitychange", onVisibilityChange);
		window.addEventListener("focus", onFocus);

		return () => {
			mountedRef.current = false;
			stopPolling();
			document.removeEventListener("visibilitychange", onVisibilityChange);
			window.removeEventListener("focus", onFocus);
		};
	}, [projectPath, fetchStatus]);

	const handleBranchChanged = useCallback(() => {
		fetchStatus();
		if (onRefresh) onRefresh();
	}, [fetchStatus, onRefresh]);

	if (!status || !status.isRepo) return null;

	const hasChanges =
		status.modified + status.staged + status.untracked + status.conflicted > 0;

	return (
		<div className="flex items-center gap-2 flex-wrap relative">
			{/* Branch — clickable */}
			<button
				onClick={() => setShowBranchPicker(!showBranchPicker)}
				className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-connexio-bg-tertiary hover:bg-connexio-accent/10 transition-colors cursor-pointer"
				title="Switch branch"
				type="button"
			>
				<GitBranch size={10} className="text-connexio-accent" />
				<span className="text-[10px] font-medium text-connexio-text-secondary">
					{status.branch}
				</span>
				<ChevronDown size={8} className="text-connexio-text-muted" />
			</button>

			{/* Branch Picker */}
			{showBranchPicker && onMessage && (
				<BranchPicker
					projectPath={projectPath}
					currentBranch={status.branch}
					onClose={() => setShowBranchPicker(false)}
					onMessage={onMessage}
					onBranchChanged={handleBranchChanged}
				/>
			)}

			{/* Ahead/Behind */}
			{(status.ahead > 0 || status.behind > 0) && (
				<div className="flex items-center gap-1">
					{status.ahead > 0 && (
						<div className="flex items-center gap-0.5 text-[10px] text-green-400">
							<ArrowUp size={9} />
							<span>{status.ahead}</span>
						</div>
					)}
					{status.behind > 0 && (
						<div className="flex items-center gap-0.5 text-[10px] text-yellow-400">
							<ArrowDown size={9} />
							<span>{status.behind}</span>
						</div>
					)}
				</div>
			)}

			{/* Changes summary */}
			{hasChanges && (
				<div className="flex items-center gap-1.5">
					{status.staged > 0 && (
						<span
							className="text-[10px] text-green-400"
							title={`${status.staged} staged`}
						>
							+{status.staged}
						</span>
					)}
					{status.modified > 0 && (
						<span
							className="text-[10px] text-yellow-400"
							title={`${status.modified} modified`}
						>
							~{status.modified}
						</span>
					)}
					{status.untracked > 0 && (
						<span
							className="text-[10px] text-connexio-text-muted"
							title={`${status.untracked} untracked`}
						>
							?{status.untracked}
						</span>
					)}
					{status.conflicted > 0 && (
						<div
							className="flex items-center gap-0.5 text-[10px] text-red-400"
							title={`${status.conflicted} conflicts`}
						>
							<AlertCircle size={9} />
							<span>{status.conflicted}</span>
						</div>
					)}
				</div>
			)}

			{/* Last commit */}
			{status.lastCommit && (
				<div
					className="flex items-center gap-1 max-w-[150px]"
					title={`${status.lastCommit} (${status.lastCommitTime})`}
				>
					<GitCommit
						size={9}
						className="text-connexio-text-muted flex-shrink-0"
					/>
					<span className="text-[10px] text-connexio-text-muted truncate">
						{status.lastCommitTime}
					</span>
				</div>
			)}
		</div>
	);
}
