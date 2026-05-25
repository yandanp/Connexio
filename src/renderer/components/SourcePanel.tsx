import {
	AlertCircle,
	Check,
	ChevronDown,
	ChevronRight,
	FileCode,
	FileMinus,
	FilePlus,
	FileQuestion,
	FileWarning,
	Loader2,
	Maximize2,
	Minus,
	Plus,
	RefreshCw,
	RotateCcw,
	Search,
	Undo2,
	X,
} from "lucide-react";
import {
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { GitChangedFile, GitDiffResult } from "../../shared/types";
import ConfirmDialog from "./ConfirmDialog";
import DiffModal, { type DiffFileContext } from "./DiffModal";
import DiffViewer from "./DiffViewer";
import CommitBox from "./git/CommitBox";
import GitHistoryPanel from "./git/GitHistoryPanel";
import GitStatusBar from "./GitStatusBar";

interface Props {
	projectPath: string;
}

type FileGroup = "staged" | "modified" | "untracked" | "conflicted";

interface GroupedFiles {
	staged: GitChangedFile[];
	modified: GitChangedFile[];
	untracked: GitChangedFile[];
	conflicted: GitChangedFile[];
}

// ============================================
// Module-level caches (survive unmount / tab switch)
// ============================================

/** Cap on number of projects kept in memory */
const MAX_CACHED_PROJECTS = 3;
/** Cap on number of diff entries in memory */
const MAX_CACHED_DIFFS = 20;

/** File list per project path — instant render on reopen */
const filesCache = new Map<string, GitChangedFile[]>();
/** Last fetch timestamp per project — skip redundant fetches */
const lastFetchTime = new Map<string, number>();
/** Skip re-fetching if last fetch was within this window */
const FETCH_COOLDOWN_MS = 5000;
/** Rendering thousands of changed files at once can lock the renderer. */
const INITIAL_VISIBLE_FILES_PER_GROUP = 200;
const LOAD_MORE_FILES_STEP = 500;
/** Diff cache keyed by `${projectPath}::${group}::${filePath}` */
const diffCache = new Map<string, GitDiffResult>();
/** Prevent concurrent fetches per project */
const inflightFetches = new Map<string, Promise<GitChangedFile[]>>();

function cacheKey(projectPath: string, group: FileGroup, path: string): string {
	return `${projectPath}::${group}::${path}`;
}

function invalidateDiffCache(projectPath: string) {
	const prefix = `${projectPath}::`;
	for (const key of diffCache.keys()) {
		if (key.startsWith(prefix)) diffCache.delete(key);
	}
}

/** Evict oldest project caches when exceeding cap. Uses Map iteration order (insertion). */
function evictOldProjectsIfNeeded(currentPath: string) {
	if (filesCache.size <= MAX_CACHED_PROJECTS) return;
	for (const key of filesCache.keys()) {
		if (filesCache.size <= MAX_CACHED_PROJECTS) break;
		if (key === currentPath) continue;
		filesCache.delete(key);
		lastFetchTime.delete(key);
		invalidateDiffCache(key);
	}
}

/** Trim diff cache — keep current project's entries, evict others. */
function trimDiffCache(currentPath: string) {
	if (diffCache.size <= MAX_CACHED_DIFFS) return;
	const currentPrefix = `${currentPath}::`;
	for (const key of diffCache.keys()) {
		if (diffCache.size <= MAX_CACHED_DIFFS) break;
		if (!key.startsWith(currentPrefix)) {
			diffCache.delete(key);
		}
	}
	// If still over cap, start evicting current project's oldest entries
	if (diffCache.size > MAX_CACHED_DIFFS) {
		for (const key of diffCache.keys()) {
			if (diffCache.size <= MAX_CACHED_DIFFS) break;
			diffCache.delete(key);
		}
	}
}

// ============================================
// Pure helpers
// ============================================

function groupFiles(files: GitChangedFile[]): GroupedFiles {
	const grouped: GroupedFiles = { staged: [], modified: [], untracked: [], conflicted: [] };

	for (const file of files) {
		const x = file.indexStatus as string;
		const y = file.workTreeStatus as string;

		// Conflict detection
		if (
			x === "U" ||
			y === "U" ||
			(x === "A" && y === "A") ||
			(x === "D" && y === "D")
		) {
			grouped.conflicted.push(file);
			continue;
		}

		if (file.indexStatus === "?" && file.workTreeStatus === "?") {
			grouped.untracked.push(file);
		} else {
			if (file.indexStatus !== " " && file.indexStatus !== "?") {
				grouped.staged.push(file);
			}
			if (file.workTreeStatus !== " " && file.workTreeStatus !== "?") {
				grouped.modified.push(file);
			}
		}
	}

	return grouped;
}

function getStatusLabel(status: string): string {
	switch (status) {
		case "M":
			return "Modified";
		case "A":
			return "Added";
		case "D":
			return "Deleted";
		case "R":
			return "Renamed";
		case "C":
			return "Copied";
		case "U":
			return "Conflict";
		case "?":
			return "Untracked";
		default:
			return "";
	}
}

function getStatusIcon(status: string, group: FileGroup) {
	if (group === "untracked")
		return <FileQuestion size={12} className="text-connexio-text-muted" />;
	switch (status) {
		case "M":
			return <FileCode size={12} className="text-yellow-400" />;
		case "A":
			return <FilePlus size={12} className="text-green-400" />;
		case "D":
			return <FileMinus size={12} className="text-red-400" />;
		case "U":
			return <FileWarning size={12} className="text-orange-400" />;
		default:
			return <FileCode size={12} className="text-connexio-text-muted" />;
	}
}

function getFileName(filePath: string): string {
	return filePath.split("/").pop() || filePath;
}

function getFileDir(filePath: string): string {
	const parts = filePath.split("/");
	if (parts.length <= 1) return "";
	return `${parts.slice(0, -1).join("/")}/`;
}

// ============================================
// Source Message (inline feedback)
// ============================================

interface SourceMessage {
	type: "success" | "error" | "info";
	text: string;
}

const MESSAGE_AUTO_HIDE_MS = 4000;

// ============================================
// Filter helper
// ============================================

function filterFiles(
	files: GitChangedFile[],
	query: string,
	group: FileGroup,
): GitChangedFile[] {
	const q = query.trim().toLowerCase();
	if (!q) return files;

	return files.filter((file) => {
		const filePath = file.path.toLowerCase();
		const fileName = getFileName(file.path).toLowerCase();
		const status = group === "staged" ? file.indexStatus : file.workTreeStatus;

		// Match status shorthand: "M", "A", "D", "?"
		if (q.length === 1 && status.toLowerCase() === q) return true;

		// Match group prefix: "staged", "modified", "untracked"
		if (q.startsWith("group:")) {
			return group === q.slice(6);
		}

		// Match status prefix: "status:M"
		if (q.startsWith("status:")) {
			return status.toLowerCase() === q.slice(7);
		}

		// Default: match file path or name
		return filePath.includes(q) || fileName.includes(q);
	});
}

// ============================================
// Changed File Item (memoized)
// ============================================

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
	const [diff, setDiff] = useState<GitDiffResult | null>(
		() => diffCache.get(key) ?? null,
	);
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
				result = await window.connexio.git.diffUntracked(
					projectPath,
					file.path,
				);
			} else {
				result = await window.connexio.git.diff(
					projectPath,
					file.path,
					group === "staged",
				);
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
					isExpanded
						? "bg-connexio-bg-tertiary"
						: "hover:bg-connexio-bg-tertiary"
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
									: "text-connexio-text-muted bg-connexio-bg-tertiary"
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
				<div className="mx-1 mb-1 rounded overflow-hidden border border-connexio-border bg-connexio-bg-primary">
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
					{diff &&
						!diff.isBinary &&
						!diff.isTooLarge &&
						diff.hunks.length > 0 && (
							<button
								onClick={onMaximize}
								className="w-full px-2 py-1 text-[10px] text-connexio-text-muted hover:text-connexio-accent hover:bg-connexio-bg-tertiary border-t border-connexio-border transition-colors flex items-center justify-center gap-1"
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

// ============================================
// Skeleton loader for first load
// ============================================

function SkeletonList() {
	return (
		<div className="px-2 py-1 space-y-1">
			{[0, 1, 2].map((i) => (
				<div key={i} className="flex items-center gap-1 px-2 py-1">
					<div className="w-3 h-3 rounded bg-connexio-bg-tertiary animate-pulse" />
					<div
						className="flex-1 h-3 rounded bg-connexio-bg-tertiary animate-pulse"
						style={{ animationDelay: `${i * 80}ms` }}
					/>
					<div className="w-6 h-3 rounded bg-connexio-bg-tertiary animate-pulse" />
				</div>
			))}
		</div>
	);
}

// ============================================
// Source Panel (Main Component)
// ============================================

export default function SourcePanel({ projectPath }: Props) {
	// Seed from cache to avoid flash of empty state on tab switch
	const [files, setFiles] = useState<GitChangedFile[]>(
		() => filesCache.get(projectPath) ?? [],
	);
	const [isInitialLoad, setIsInitialLoad] = useState(
		() => !filesCache.has(projectPath),
	);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
	const [collapsedGroups, setCollapsedGroups] = useState<Set<FileGroup>>(
		new Set(),
	);
	const [visibleLimits, setVisibleLimits] = useState<Record<FileGroup, number>>({
		staged: INITIAL_VISIBLE_FILES_PER_GROUP,
		modified: INITIAL_VISIBLE_FILES_PER_GROUP,
		untracked: INITIAL_VISIBLE_FILES_PER_GROUP,
		conflicted: INITIAL_VISIBLE_FILES_PER_GROUP,
	});
	const [modalOpen, setModalOpen] = useState(false);
	const [modalInitialIndex, setModalInitialIndex] = useState(0);
	const [filterQuery, setFilterQuery] = useState("");
	const [showFilter, setShowFilter] = useState(false);
	const [message, setMessage] = useState<SourceMessage | null>(null);
	const [globalActionLoading, setGlobalActionLoading] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<"changes" | "history">("changes");
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const mountedRef = useRef(true);
	const activeProjectPathRef = useRef(projectPath);
	const filterInputRef = useRef<HTMLInputElement>(null);
	const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		activeProjectPathRef.current = projectPath;
	}, [projectPath]);

	const showMessage = useCallback((msg: SourceMessage) => {
		setMessage(msg);
		if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
		messageTimerRef.current = setTimeout(() => {
			setMessage(null);
		}, MESSAGE_AUTO_HIDE_MS);
	}, []);

	const dismissMessage = useCallback(() => {
		setMessage(null);
		if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
	}, []);

	const fetchFiles = useCallback(
		async (opts?: { silent?: boolean; force?: boolean }) => {
			const targetPath = projectPath;

			// Skip if recently fetched (unless forced)
			if (!opts?.force) {
				const last = lastFetchTime.get(targetPath) ?? 0;
				if (Date.now() - last < FETCH_COOLDOWN_MS && filesCache.has(targetPath)) {
					return;
				}
			}

			// Dedupe concurrent requests
			let promise = inflightFetches.get(targetPath);
			if (!promise) {
				promise = (async () => {
					try {
						return await window.connexio.git.changedFiles(targetPath);
					} catch {
						return [];
					}
				})();
				inflightFetches.set(targetPath, promise);
				promise.finally(() => {
					inflightFetches.delete(targetPath);
				});
			}

			if (!opts?.silent) setIsRefreshing(true);
			const result = await promise;
			filesCache.set(targetPath, result);
			lastFetchTime.set(targetPath, Date.now());
			evictOldProjectsIfNeeded(targetPath);
			// Ignore stale results if user already switched to a different project
			if (mountedRef.current && activeProjectPathRef.current === targetPath) {
				setFiles(result);
				setIsInitialLoad(false);
				setIsRefreshing(false);
			}
		},
		[projectPath],
	);

	useEffect(() => {
		mountedRef.current = true;

		// Reset local state when project changes
		setExpandedFiles(new Set());
		setVisibleLimits({
			staged: INITIAL_VISIBLE_FILES_PER_GROUP,
			modified: INITIAL_VISIBLE_FILES_PER_GROUP,
			untracked: INITIAL_VISIBLE_FILES_PER_GROUP,
			conflicted: INITIAL_VISIBLE_FILES_PER_GROUP,
		});
		setModalOpen(false);
		setFilterQuery("");
		setMessage(null);
		setGlobalActionLoading(null);
		trimDiffCache(projectPath);

		// Seed from cache immediately
		const cached = filesCache.get(projectPath);
		if (cached) {
			setFiles(cached);
			setIsInitialLoad(false);
		} else {
			setFiles([]);
			setIsInitialLoad(true);
		}

		// Trigger fetch but don't block UI — cached files render immediately
		fetchFiles({ silent: filesCache.has(projectPath) });

		const startPolling = () => {
			if (intervalRef.current) return;
			intervalRef.current = setInterval(() => {
				fetchFiles({ silent: true, force: true });
			}, 60000);
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
				fetchFiles({ silent: true });
				startPolling();
			}
		};
		const onFocus = () => fetchFiles({ silent: true });

		document.addEventListener("visibilitychange", onVisibilityChange);
		window.addEventListener("focus", onFocus);

		return () => {
			mountedRef.current = false;
			stopPolling();
			document.removeEventListener("visibilitychange", onVisibilityChange);
			window.removeEventListener("focus", onFocus);
		};
	}, [fetchFiles, projectPath]);

	const grouped = useMemo(() => groupFiles(files), [files]);

	// Apply filter to each group
	const filteredGrouped = useMemo(() => {
		if (!filterQuery.trim()) return grouped;
		return {
			staged: filterFiles(grouped.staged, filterQuery, "staged"),
			modified: filterFiles(grouped.modified, filterQuery, "modified"),
			untracked: filterFiles(grouped.untracked, filterQuery, "untracked"),
			conflicted: filterFiles(grouped.conflicted, filterQuery, "conflicted"),
		};
	}, [grouped, filterQuery]);

	const totalChanges =
		grouped.staged.length + grouped.modified.length + grouped.untracked.length + grouped.conflicted.length;
	const filteredTotal =
		filteredGrouped.staged.length + filteredGrouped.modified.length + filteredGrouped.untracked.length + filteredGrouped.conflicted.length;

	const modalFiles = useMemo<DiffFileContext[]>(() => {
		return [
			...filteredGrouped.conflicted.map((f) => ({ file: f, group: "modified" as const })),
			...filteredGrouped.staged.map((f) => ({ file: f, group: "staged" as const })),
			...filteredGrouped.modified.map((f) => ({ file: f, group: "modified" as const })),
			...filteredGrouped.untracked.map((f) => ({
				file: f,
				group: "untracked" as const,
			})),
		];
	}, [filteredGrouped.conflicted, filteredGrouped.staged, filteredGrouped.modified, filteredGrouped.untracked]);

	const toggleFile = useCallback((key: string) => {
		setExpandedFiles((prev) => {
			const next = new Set(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
				// Cap open previews to 5 — evict oldest (first inserted)
				if (next.size > 5) {
					const oldest = next.values().next().value;
					if (oldest) next.delete(oldest);
				}
			}
			return next;
		});
	}, []);

	const toggleGroup = useCallback((group: FileGroup) => {
		setCollapsedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(group)) {
				next.delete(group);
			} else {
				next.add(group);
			}
			return next;
		});
	}, []);

	const handleShowMore = useCallback((group: FileGroup) => {
		setVisibleLimits((prev) => ({
			...prev,
			[group]: prev[group] + LOAD_MORE_FILES_STEP,
		}));
	}, []);

	const handleRefresh = useCallback(() => {
		invalidateDiffCache(projectPath);
		setExpandedFiles(new Set());
		fetchFiles({ force: true });
	}, [fetchFiles, projectPath]);

	const handleStageAll = useCallback(async () => {
		if (globalActionLoading) return;
		setGlobalActionLoading("stage-all");
		try {
			await window.connexio.git.stageAll(projectPath);
			invalidateDiffCache(projectPath);
			await fetchFiles({ force: true });
			showMessage({ type: "success", text: "All changes staged" });
		} catch {
			showMessage({ type: "error", text: "Failed to stage all changes" });
		}
		setGlobalActionLoading(null);
	}, [fetchFiles, projectPath, globalActionLoading, showMessage]);

	const handleUnstageAll = useCallback(async () => {
		if (globalActionLoading) return;
		setGlobalActionLoading("unstage-all");
		try {
			await window.connexio.git.unstageAll(projectPath);
			invalidateDiffCache(projectPath);
			await fetchFiles({ force: true });
			showMessage({ type: "success", text: "All changes unstaged" });
		} catch {
			showMessage({ type: "error", text: "Failed to unstage all changes" });
		}
		setGlobalActionLoading(null);
	}, [fetchFiles, projectPath, globalActionLoading, showMessage]);

	const openModal = useCallback(
		(file: GitChangedFile, group: FileGroup) => {
			const idx = modalFiles.findIndex(
				(f) => f.file.path === file.path && f.group === group,
			);
			setModalInitialIndex(idx >= 0 ? idx : 0);
			setModalOpen(true);
		},
		[modalFiles],
	);

	// Stable handlers per (group, path) for memoized item
	const makeToggle = useCallback(
		(key: string) => () => toggleFile(key),
		[toggleFile],
	);
	const makeMaximize = useCallback(
		(file: GitChangedFile, group: FileGroup) => () => openModal(file, group),
		[openModal],
	);

	const renderGroup = (
		group: FileGroup,
		label: string,
		items: GitChangedFile[],
	) => {
		if (items.length === 0) return null;
		const isCollapsed = collapsedGroups.has(group);
		const visibleLimit = visibleLimits[group];
		const visibleItems = items.slice(0, visibleLimit);
		const hiddenCount = Math.max(0, items.length - visibleItems.length);

		return (
			<div className="mb-1">
				<div
					role="button"
					tabIndex={0}
					className="flex items-center gap-1 px-2 py-1.5 cursor-pointer hover:bg-connexio-bg-tertiary transition-colors"
					onClick={() => toggleGroup(group)}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							toggleGroup(group);
						}
					}}
				>
					{isCollapsed ? (
						<ChevronRight size={11} className={group === "conflicted" ? "text-red-400" : "text-connexio-text-muted"} />
					) : (
						<ChevronDown size={11} className={group === "conflicted" ? "text-red-400" : "text-connexio-text-muted"} />
					)}
					<span className={`text-[10px] font-semibold uppercase tracking-wider flex-1 ${
						group === "conflicted" ? "text-red-300" : "text-connexio-text-secondary"
					}`}>
						{label}
					</span>
					<span className={`text-[10px] px-1.5 rounded-full ${
						group === "conflicted"
							? "text-red-300 bg-red-500/15"
							: "text-connexio-text-muted bg-connexio-bg-tertiary"
					}`}>
						{items.length}
					</span>

					{group === "staged" && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								handleUnstageAll();
							}}
							className="p-0.5 rounded hover:bg-connexio-bg-primary transition-colors"
							title="Unstage all"
							type="button"
						>
							<Minus size={10} className="text-yellow-400" />
						</button>
					)}
					{(group === "modified" || group === "untracked") && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								handleStageAll();
							}}
							className="p-0.5 rounded hover:bg-connexio-bg-primary transition-colors"
							title="Stage all"
							type="button"
						>
							<Plus size={10} className="text-green-400" />
						</button>
					)}
				</div>

				{!isCollapsed && (
					<div className="space-y-0.5">
						{visibleItems.map((file) => {
							const key = `${group}:${file.path}`;
							return (
								<ChangedFileItem
									key={key}
									file={file}
									group={group}
									projectPath={projectPath}
									isExpanded={expandedFiles.has(key)}
									onToggle={makeToggle(key)}
									onRefresh={handleRefresh}
									onMaximize={makeMaximize(file, group)}
									onMessage={showMessage}
								/>
							);
						})}
						{hiddenCount > 0 && (
							<button
								onClick={() => handleShowMore(group)}
								className="mx-2 my-1 w-[calc(100%-1rem)] rounded border border-connexio-border px-2 py-1.5 text-[10px] text-connexio-text-muted hover:border-connexio-accent/50 hover:text-connexio-accent hover:bg-connexio-bg-tertiary transition-colors"
								type="button"
							>
								Show {Math.min(hiddenCount, LOAD_MORE_FILES_STEP)} more of {hiddenCount} hidden files
							</button>
						)}
					</div>
				)}
			</div>
		);
	};

	return (
		<>
			<div className="flex flex-col h-full">
				{/* Git status bar */}
				<div className="px-3 py-1.5 border-b border-connexio-border relative overflow-visible">
					<GitStatusBar projectPath={projectPath} onMessage={showMessage} onRefresh={handleRefresh} />
				</div>

				{/* Tab switcher: Changes / History */}
				<div className="flex items-center border-b border-connexio-border">
					<button
						onClick={() => setActiveTab("changes")}
						className={`flex-1 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
							activeTab === "changes"
								? "text-connexio-accent border-b-2 border-connexio-accent"
								: "text-connexio-text-muted hover:text-connexio-text-secondary"
						}`}
						type="button"
					>
						Changes
						{totalChanges > 0 && (
							<span className="ml-1 text-connexio-accent/70">({totalChanges})</span>
						)}
					</button>
					<button
						onClick={() => setActiveTab("history")}
						className={`flex-1 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
							activeTab === "history"
								? "text-connexio-accent border-b-2 border-connexio-accent"
								: "text-connexio-text-muted hover:text-connexio-text-secondary"
						}`}
						type="button"
					>
						History
					</button>
				</div>

				{/* History tab */}
				{activeTab === "history" && (
					<div className="flex-1 min-h-0 overflow-hidden">
						<GitHistoryPanel projectPath={projectPath} />
					</div>
				)}

				{/* Changes tab */}
				{activeTab === "changes" && (
					<div className="flex flex-col flex-1 min-h-0">
						{/* Commit box */}
						<CommitBox
							projectPath={projectPath}
							stagedCount={grouped.staged.length}
							hasUncommittedChanges={totalChanges > 0}
							hasUpstream={true}
							onMessage={showMessage}
							onRefresh={handleRefresh}
						/>

				<div className="flex items-center gap-1 px-3 py-1.5 border-b border-connexio-border">
					<span className="text-[10px] text-connexio-text-muted flex-1">
						{filteredTotal !== totalChanges && filterQuery
							? `${filteredTotal} of ${totalChanges} files`
							: `${totalChanges} file${totalChanges !== 1 ? "s" : ""}`}
					</span>
					<button
						onClick={() => {
							setShowFilter(!showFilter);
							if (!showFilter) {
								setTimeout(() => filterInputRef.current?.focus(), 0);
							} else {
								setFilterQuery("");
							}
						}}
						className={`p-1 rounded transition-colors ${
							showFilter
								? "bg-connexio-accent/10 text-connexio-accent"
								: "hover:bg-connexio-bg-tertiary text-connexio-text-muted"
						}`}
						title="Filter files (Ctrl+F)"
						type="button"
					>
						<Search size={11} />
					</button>
					<button
						onClick={handleRefresh}
						className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
						title="Refresh"
						type="button"
						disabled={isRefreshing}
					>
						<RefreshCw
							size={11}
							className={`text-connexio-text-muted ${isRefreshing ? "animate-spin" : ""}`}
						/>
					</button>
					{grouped.modified.length + grouped.untracked.length > 0 && (
						<button
							onClick={handleStageAll}
							className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
							title="Stage all changes"
							type="button"
							disabled={globalActionLoading === "stage-all"}
						>
							{globalActionLoading === "stage-all" ? (
								<Loader2 size={11} className="text-green-400 animate-spin" />
							) : (
								<Plus size={11} className="text-green-400" />
							)}
						</button>
					)}
					{grouped.staged.length > 0 && (
						<button
							onClick={handleUnstageAll}
							className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
							title="Unstage all"
							type="button"
							disabled={globalActionLoading === "unstage-all"}
						>
							{globalActionLoading === "unstage-all" ? (
								<Loader2 size={11} className="text-yellow-400 animate-spin" />
							) : (
								<RotateCcw size={11} className="text-yellow-400" />
							)}
						</button>
					)}
				</div>

				{/* Filter bar */}
				{showFilter && (
					<div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-connexio-border bg-connexio-bg-primary">
						<Search size={10} className="text-connexio-text-muted flex-shrink-0" />
						<input
							ref={filterInputRef}
							type="text"
							value={filterQuery}
							onChange={(e) => setFilterQuery(e.target.value)}
							placeholder="Filter files... (path, name, M/A/D/?)"
							className="flex-1 bg-transparent text-[11px] text-connexio-text outline-none placeholder:text-connexio-text-muted/60"
							onKeyDown={(e) => {
								if (e.key === "Escape") {
									setShowFilter(false);
									setFilterQuery("");
								}
							}}
						/>
						{filterQuery && (
							<span className="text-[9px] text-connexio-text-muted tabular-nums">
								{filteredTotal}/{totalChanges}
							</span>
						)}
						<button
							onClick={() => {
								setShowFilter(false);
								setFilterQuery("");
							}}
							className="p-0.5 rounded hover:bg-connexio-bg-tertiary transition-colors"
							type="button"
						>
							<X size={10} className="text-connexio-text-muted" />
						</button>
					</div>
				)}

				{/* Inline message */}
				{message && (
					<div
						className={`flex items-center gap-1.5 px-3 py-1.5 border-b border-connexio-border text-[10px] ${
							message.type === "error"
								? "bg-red-500/10 text-red-300"
								: message.type === "success"
									? "bg-green-500/10 text-green-300"
									: "bg-blue-500/10 text-blue-300"
						}`}
					>
						{message.type === "error" ? (
							<AlertCircle size={10} className="flex-shrink-0" />
						) : message.type === "success" ? (
							<Check size={10} className="flex-shrink-0" />
						) : null}
						<span className="flex-1 truncate">{message.text}</span>
						<button
							onClick={dismissMessage}
							className="p-0.5 rounded hover:bg-white/10 transition-colors flex-shrink-0"
							type="button"
						>
							<X size={9} />
						</button>
					</div>
				)}

				<div className="flex-1 overflow-y-auto py-1">
					{isInitialLoad ? (
						<SkeletonList />
					) : totalChanges === 0 ? (
						<div className="flex flex-col items-center justify-center py-8 px-4">
							<FileCode
								size={24}
								className="text-connexio-text-muted/30 mb-2"
							/>
							<p className="text-[11px] text-connexio-text-muted text-center">
								No changes detected
							</p>
							<p className="text-[10px] text-connexio-text-muted/60 text-center mt-0.5">
								Working tree is clean
							</p>
						</div>
					) : filteredTotal === 0 && filterQuery ? (
						<div className="flex flex-col items-center justify-center py-8 px-4">
							<Search
								size={20}
								className="text-connexio-text-muted/30 mb-2"
							/>
							<p className="text-[11px] text-connexio-text-muted text-center">
								No files match "{filterQuery}"
							</p>
						</div>
					) : (
						<>
							{/* Conflict banner */}
							{filteredGrouped.conflicted.length > 0 && (
								<div className="mx-2 mt-1 mb-2 px-2.5 py-2 rounded border border-red-500/30 bg-red-500/5">
									<div className="flex items-center gap-1.5 mb-1">
										<AlertCircle size={11} className="text-red-400" />
										<span className="text-[10px] font-semibold text-red-300">
											Merge Conflicts ({filteredGrouped.conflicted.length})
										</span>
									</div>
									<p className="text-[9px] text-red-300/70 leading-tight">
										Resolve conflicts, then stage files and commit.
									</p>
								</div>
							)}
							{renderGroup("conflicted", "Conflicts", filteredGrouped.conflicted)}
							{renderGroup("staged", "Staged", filteredGrouped.staged)}
							{renderGroup("modified", "Modified", filteredGrouped.modified)}
							{renderGroup("untracked", "Untracked", filteredGrouped.untracked)}
						</>
					)}
				</div>
					</div>
				)}
			</div>

			{modalOpen && modalFiles.length > 0 && (
				<DiffModal
					projectPath={projectPath}
					files={modalFiles}
					initialIndex={Math.min(modalInitialIndex, modalFiles.length - 1)}
					onClose={() => setModalOpen(false)}
					onRefresh={handleRefresh}
				/>
			)}
		</>
	);
}
