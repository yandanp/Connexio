import { Clock, Copy, GitCommit, Loader2, RefreshCw, User } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GitCommitEntry } from "../../../shared/types";

interface Props {
	projectPath: string;
}

const INITIAL_LIMIT = 50;
const LOAD_MORE_STEP = 50;

export default function GitHistoryPanel({ projectPath }: Props) {
	const [commits, setCommits] = useState<GitCommitEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [limit, setLimit] = useState(INITIAL_LIMIT);
	const [hasMore, setHasMore] = useState(true);
	const [copiedHash, setCopiedHash] = useState<string | null>(null);
	const mountedRef = useRef(true);
	const activePathRef = useRef(projectPath);

	const fetchHistory = useCallback(
		async (fetchLimit: number, append = false) => {
			const targetPath = projectPath;
			if (!append) setLoading(true);
			else setLoadingMore(true);

			try {
				const result = await window.connexio.git.history(targetPath, fetchLimit);
				if (mountedRef.current && activePathRef.current === targetPath) {
					if (append) {
						setCommits(result);
					} else {
						setCommits(result);
					}
					setHasMore(result.length >= fetchLimit);
				}
			} catch {
				if (mountedRef.current && activePathRef.current === targetPath) {
					setCommits([]);
					setHasMore(false);
				}
			}

			if (mountedRef.current) {
				setLoading(false);
				setLoadingMore(false);
			}
		},
		[projectPath],
	);

	useEffect(() => {
		mountedRef.current = true;
		activePathRef.current = projectPath;
		setCommits([]);
		setLimit(INITIAL_LIMIT);
		setHasMore(true);
		fetchHistory(INITIAL_LIMIT);

		return () => {
			mountedRef.current = false;
		};
	}, [projectPath, fetchHistory]);

	const handleLoadMore = useCallback(() => {
		const newLimit = limit + LOAD_MORE_STEP;
		setLimit(newLimit);
		fetchHistory(newLimit, true);
	}, [limit, fetchHistory]);

	const handleRefresh = useCallback(() => {
		setLimit(INITIAL_LIMIT);
		fetchHistory(INITIAL_LIMIT);
	}, [fetchHistory]);

	const handleCopyHash = useCallback((hash: string, short: string) => {
		navigator.clipboard.writeText(hash);
		setCopiedHash(short);
		setTimeout(() => setCopiedHash(null), 2000);
	}, []);

	if (loading) {
		return (
			<div className="flex items-center justify-center py-8 gap-2 text-connexio-text-muted">
				<Loader2 size={14} className="animate-spin" />
				<span className="text-[11px]">Loading history...</span>
			</div>
		);
	}

	if (commits.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-8 px-4">
				<GitCommit size={20} className="text-connexio-text-muted/30 mb-2" />
				<p className="text-[11px] text-connexio-text-muted text-center">
					No commit history
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex items-center gap-1 px-3 py-2 border-b border-connexio-border">
				<span className="text-[10px] font-semibold text-connexio-text-secondary uppercase tracking-wider flex-1">
					History
					<span className="ml-1 text-connexio-text-muted font-normal normal-case">
						({commits.length}{hasMore ? "+" : ""})
					</span>
				</span>
				<button
					onClick={handleRefresh}
					className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
					title="Refresh history"
					type="button"
				>
					<RefreshCw size={11} className="text-connexio-text-muted" />
				</button>
			</div>

			{/* Commit list */}
			<div className="flex-1 overflow-y-auto">
				{commits.map((commit) => (
					<div
						key={commit.hash}
						className="group px-3 py-2 border-b border-connexio-border/50 hover:bg-connexio-bg-tertiary transition-colors"
					>
						<div className="flex items-start gap-2">
							{/* Hash */}
							<button
								onClick={() => handleCopyHash(commit.hash, commit.shortHash)}
								className="flex-shrink-0 font-mono text-[10px] text-connexio-accent/80 hover:text-connexio-accent bg-connexio-accent/5 hover:bg-connexio-accent/10 px-1.5 py-0.5 rounded transition-colors"
								title={`Copy full hash: ${commit.hash}`}
								type="button"
							>
								{copiedHash === commit.shortHash ? (
									<span className="text-green-400 flex items-center gap-0.5">
										<Copy size={8} />
										copied
									</span>
								) : (
									commit.shortHash
								)}
							</button>

							{/* Subject */}
							<div className="flex-1 min-w-0">
								<p className="text-[11px] text-connexio-text leading-tight truncate">
									{commit.subject}
								</p>
								<div className="flex items-center gap-2 mt-0.5">
									<span className="flex items-center gap-0.5 text-[9px] text-connexio-text-muted">
										<User size={8} />
										{commit.author}
									</span>
									<span className="flex items-center gap-0.5 text-[9px] text-connexio-text-muted">
										<Clock size={8} />
										{commit.relativeTime}
									</span>
								</div>
							</div>
						</div>
					</div>
				))}

				{/* Load more */}
				{hasMore && (
					<button
						onClick={handleLoadMore}
						disabled={loadingMore}
						className="w-full px-3 py-2 text-[10px] text-connexio-text-muted hover:text-connexio-accent hover:bg-connexio-bg-tertiary transition-colors flex items-center justify-center gap-1"
						type="button"
					>
						{loadingMore ? (
							<>
								<Loader2 size={10} className="animate-spin" />
								Loading...
							</>
						) : (
							<>Load more commits</>
						)}
					</button>
				)}
			</div>
		</div>
	);
}
