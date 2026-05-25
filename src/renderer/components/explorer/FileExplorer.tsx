import {
	ChevronDown,
	ChevronRight,
	File,
	FileCode,
	FileJson,
	FileText,
	FilePlus,
	Folder,
	FolderOpen,
	FolderPlus,
	Image,
	Loader2,
	RefreshCw,
	Search,
	Terminal,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import ExplorerContextMenu from "./ExplorerContextMenu";
import { useGitFileStatus, type GitFileIndicator, type GitFileStatusMap } from "../../hooks/useGitFileStatus";

interface FileEntry {
	name: string;
	path: string;
	isDir: boolean;
	isHidden: boolean;
	extension: string | null;
	size: number | null;
	children: FileEntry[] | null;
}

interface Props {
	projectPath: string;
	onOpenInTerminal?: (path: string) => void;
	onOpenFile?: (filePath: string, lineNumber?: number) => void;
	onOpenFileInSplit?: (filePath: string, direction: "horizontal" | "vertical") => void;
}

interface SearchResult {
	filePath: string;
	lineNumber: number;
	lineContent: string;
}

function parentDir(filePath: string): string {
	const normalized = filePath.replace(/\\/g, "/");
	return normalized.substring(0, normalized.lastIndexOf("/"));
}

function joinPath(dir: string, name: string): string {
	const d = dir.replace(/\\/g, "/").replace(/\/$/, "");
	return `${d}/${name}`;
}

function getFileIcon(entry: FileEntry) {
	if (entry.isDir) return null;
	const ext = entry.extension?.toLowerCase();
	switch (ext) {
		case "ts": case "tsx": case "js": case "jsx": case "py": case "rs":
		case "go": case "java": case "c": case "cpp": case "cs": case "php":
			return <FileCode size={14} className="text-blue-400 flex-shrink-0" />;
		case "json": case "yaml": case "yml": case "toml":
			return <FileJson size={14} className="text-yellow-400 flex-shrink-0" />;
		case "md": case "txt": case "log":
			return <FileText size={14} className="text-gray-400 flex-shrink-0" />;
		case "png": case "jpg": case "jpeg": case "gif": case "svg": case "webp":
			return <Image size={14} className="text-green-400 flex-shrink-0" />;
		case "sh": case "bash": case "ps1": case "bat": case "cmd":
			return <Terminal size={14} className="text-green-300 flex-shrink-0" />;
		default:
			return <File size={14} className="text-connexio-text-muted flex-shrink-0" />;
	}
}

// ─── Inline Input ────────────────────────────────────────────────────────────

function InlineInput({ initialValue, placeholder, onConfirm, onCancel }: {
	initialValue?: string;
	placeholder?: string;
	onConfirm: (value: string) => void;
	onCancel: () => void;
}) {
	const [value, setValue] = useState(initialValue || "");
	return (
		<input
			autoFocus
			value={value}
			placeholder={placeholder}
			onChange={(e) => setValue(e.target.value)}
			onBlur={() => { if (value.trim()) onConfirm(value.trim()); else onCancel(); }}
			onKeyDown={(e) => {
				if (e.key === "Enter" && value.trim()) { e.preventDefault(); onConfirm(value.trim()); }
				if (e.key === "Escape") onCancel();
				e.stopPropagation();
			}}
			onClick={(e) => e.stopPropagation()}
			className="flex-1 min-w-0 text-[12px] px-1 py-0 bg-connexio-bg border border-connexio-accent/60 rounded text-connexio-text outline-none"
		/>
	);
}

// ─── File Tree Node ──────────────────────────────────────────────────────────

// ─── Git Status Helpers ──────────────────────────────────────────────────────

const GIT_STATUS_COLORS: Record<GitFileIndicator, string> = {
	M: "text-yellow-400",   // Modified
	A: "text-green-400",    // Added
	D: "text-red-400",      // Deleted
	R: "text-purple-400",   // Renamed
	U: "text-orange-400",   // Unmerged
	"?": "text-emerald-500", // Untracked
	C: "text-red-500",      // Conflict
};

const GIT_STATUS_LABELS: Record<GitFileIndicator, string> = {
	M: "M",
	A: "A",
	D: "D",
	R: "R",
	U: "U",
	"?": "U",
	C: "!",
};

const GIT_STATUS_TOOLTIPS: Record<GitFileIndicator, string> = {
	M: "Modified",
	A: "Added (Staged)",
	D: "Deleted",
	R: "Renamed",
	U: "Unmerged",
	"?": "Untracked",
	C: "Conflict",
};

function GitBadge({ status }: { status: GitFileIndicator }) {
	return (
		<span
			className={`ml-auto flex-shrink-0 text-[10px] font-bold leading-none ${GIT_STATUS_COLORS[status]}`}
			title={GIT_STATUS_TOOLTIPS[status]}
		>
			{GIT_STATUS_LABELS[status]}
		</span>
	);
}

function getRelativePath(entry: FileEntry, projectPath: string): string {
	const normalized = entry.path.replace(/\\/g, "/");
	const base = projectPath.replace(/\\/g, "/").replace(/\/$/, "");
	return normalized.startsWith(base) ? normalized.slice(base.length + 1) : normalized;
}

function getGitTextColor(entry: FileEntry, gitStatusMap: GitFileStatusMap, projectPath: string): string {
	const rel = getRelativePath(entry, projectPath);
	if (entry.isDir) {
		const dirStatus = gitStatusMap.getDirStatus(rel);
		if (dirStatus) return GIT_STATUS_COLORS[dirStatus];
		return "text-connexio-text";
	}
	const status = gitStatusMap.get(rel);
	if (status) return GIT_STATUS_COLORS[status];
	return "text-connexio-text";
}

function getGitBadge(entry: FileEntry, gitStatusMap: GitFileStatusMap, projectPath: string): React.ReactNode {
	if (entry.isDir) return null;
	const rel = getRelativePath(entry, projectPath);
	const status = gitStatusMap.get(rel);
	if (!status) return null;
	return <GitBadge status={status} />;
}

function FileTreeNode({ entry, depth, onOpenFile, onContextMenu, renamingPath, onRenameConfirm, newItem, onNewItemConfirm, onNewItemCancel, gitStatusMap, projectPath }: {
	entry: FileEntry;
	depth: number;
	onOpenFile?: (filePath: string) => void;
	onContextMenu?: (e: React.MouseEvent, entry: FileEntry) => void;
	renamingPath: string | null;
	onRenameConfirm: (oldPath: string, newName: string) => void;
	newItem: { parent: string; type: "file" | "folder" } | null;
	onNewItemConfirm: (parent: string, name: string, type: "file" | "folder") => void;
	onNewItemCancel: () => void;
	gitStatusMap: GitFileStatusMap;
	projectPath: string;
}) {
	const [expanded, setExpanded] = useState(false);
	const [children, setChildren] = useState<FileEntry[] | null>(entry.children);
	const [loading, setLoading] = useState(false);

	// Auto-expand when new item targets this folder
	useEffect(() => {
		if (newItem && newItem.parent === entry.path && !expanded) {
			setExpanded(true);
			if (!children) {
				invoke<FileEntry[]>("explorer_list_dir", { dirPath: entry.path })
					.then(setChildren).catch(() => {});
			}
		}
	}, [newItem]);

	const toggleExpand = useCallback(async () => {
		if (!entry.isDir) return;
		if (!expanded && !children) {
			setLoading(true);
			const result = await invoke<FileEntry[]>("explorer_list_dir", { dirPath: entry.path }).catch(() => []);
			setChildren(result as FileEntry[]);
			setLoading(false);
		}
		setExpanded(!expanded);
	}, [expanded, children, entry]);

	const handleClick = () => {
		if (entry.isDir) toggleExpand();
		else onOpenFile?.(entry.path);
	};

	const showNewItem = newItem && newItem.parent === entry.path;

	return (
		<div>
			<div
				className={`flex items-center gap-1 px-2 py-[3px] cursor-pointer hover:bg-connexio-bg-tertiary rounded-sm transition-colors ${entry.isHidden ? "opacity-60" : ""}`}
				style={{ paddingLeft: `${depth * 12 + 8}px` }}
				onClick={handleClick}
				onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu?.(e, entry); }}
				draggable={!entry.isDir}
				onDragStart={(e) => {
					if (!entry.isDir) {
						e.dataTransfer.setData("text/plain", entry.path);
						e.dataTransfer.setData("application/connexio-file", entry.path);
						e.dataTransfer.effectAllowed = "copy";
					}
				}}
			>
				{entry.isDir ? (
					<>
						{expanded ? <ChevronDown size={12} className="text-connexio-text-muted flex-shrink-0" /> : <ChevronRight size={12} className="text-connexio-text-muted flex-shrink-0" />}
						{expanded ? <FolderOpen size={14} className="text-connexio-accent flex-shrink-0" /> : <Folder size={14} className="text-connexio-accent/70 flex-shrink-0" />}
					</>
				) : (
					<>
						<span className="w-3 flex-shrink-0" />
						{getFileIcon(entry)}
					</>
				)}

				{renamingPath === entry.path ? (
					<InlineInput
						initialValue={entry.name}
						onConfirm={(val) => onRenameConfirm(entry.path, val)}
						onCancel={() => onRenameConfirm(entry.path, entry.name)}
					/>
				) : (
					<>
						<span className={`text-[12px] truncate ${getGitTextColor(entry, gitStatusMap, projectPath)}`}>{entry.name}</span>
						{getGitBadge(entry, gitStatusMap, projectPath)}
					</>
				)}
			</div>

			{entry.isDir && expanded && (
				<div>
					{showNewItem && (
						<div className="flex items-center gap-1 px-2 py-[3px]" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>
							<span className="w-3 flex-shrink-0" />
							{newItem!.type === "folder"
								? <Folder size={14} className="text-connexio-accent/70 flex-shrink-0" />
								: <File size={14} className="text-connexio-text-muted flex-shrink-0" />}
							<InlineInput
								placeholder={newItem!.type === "folder" ? "folder-name" : "filename.ext"}
								onConfirm={(val) => onNewItemConfirm(entry.path, val, newItem!.type)}
								onCancel={onNewItemCancel}
							/>
						</div>
					)}
					{children?.map((child) => (
						<FileTreeNode
							key={child.path}
							entry={child}
							depth={depth + 1}
							onOpenFile={onOpenFile}
							onContextMenu={onContextMenu}
							renamingPath={renamingPath}
							onRenameConfirm={onRenameConfirm}
							newItem={newItem}
							onNewItemConfirm={onNewItemConfirm}
							onNewItemCancel={onNewItemCancel}
							gitStatusMap={gitStatusMap}
							projectPath={projectPath}
						/>
					))}
					{loading && (
						<div className="text-[11px] text-connexio-text-muted px-2 py-1" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>Loading...</div>
					)}
				</div>
			)}
		</div>
	);
}

// ─── Search highlight helper ─────────────────────────────────────────────────

function highlightMatch(text: string, query: string, caseSensitive: boolean) {
	if (!query) return text;
	const flags = caseSensitive ? "g" : "gi";
	const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const parts = text.split(new RegExp(`(${escaped})`, flags));
	return (
		<>
			{parts.map((part, i) => {
				const isMatch = caseSensitive
					? part === query
					: part.toLowerCase() === query.toLowerCase();
				return isMatch ? (
					<span key={i} className="bg-connexio-accent/30 text-connexio-accent font-semibold">{part}</span>
				) : (
					<span key={i}>{part}</span>
				);
			})}
		</>
	);
}

// ─── Main File Explorer ──────────────────────────────────────────────────────

export default function FileExplorer({ projectPath, onOpenInTerminal, onOpenFile, onOpenFileInSplit }: Props) {
	const [entries, setEntries] = useState<FileEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const gitStatusMap = useGitFileStatus(projectPath);
	const [showHidden, setShowHidden] = useState(false);
	const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FileEntry } | null>(null);
	const [renamingPath, setRenamingPath] = useState<string | null>(null);
	const [newItem, setNewItem] = useState<{ parent: string; type: "file" | "folder" } | null>(null);

	// Search state
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
	const [searching, setSearching] = useState(false);
	const [searched, setSearched] = useState(false);
	const [caseSensitive, setCaseSensitive] = useState(false);
	const searchInputRef = useRef<HTMLInputElement>(null);

	const refresh = useCallback(() => {
		if (!projectPath) return;
		invoke<FileEntry[]>("explorer_list_dir", { dirPath: projectPath })
			.then((result) => { setEntries(result); setLoading(false); })
			.catch(() => setLoading(false));
	}, [projectPath]);

	useEffect(() => { refresh(); }, [refresh]);

	// Reset search when project changes
	useEffect(() => {
		setSearchQuery("");
		setSearchResults([]);
		setSearched(false);
	}, [projectPath]);

	// ─── Search ─────────────────────────────────────────────────────────────

	const handleSearch = useCallback(async () => {
		const trimmed = searchQuery.trim();
		if (!trimmed) return;
		setSearching(true);
		setSearched(true);
		try {
			const res = await invoke<SearchResult[]>("explorer_search_in_files", {
				projectPath,
				query: trimmed,
				caseSensitive,
				maxResults: 200,
			});
			setSearchResults(res);
		} catch {
			setSearchResults([]);
		}
		setSearching(false);
	}, [searchQuery, projectPath, caseSensitive]);

	const clearSearch = () => {
		setSearchQuery("");
		setSearchResults([]);
		setSearched(false);
		searchInputRef.current?.focus();
	};

	// ─── Actions ─────────────────────────────────────────────────────────────

	const handleRename = async (oldPath: string, newName: string) => {
		setRenamingPath(null);
		const currentName = oldPath.replace(/\\/g, "/").split("/").pop();
		if (!newName || newName === currentName) return;
		try {
			await invoke("explorer_rename", { oldPath, newPath: joinPath(parentDir(oldPath), newName) });
			refresh();
		} catch (e) {
			console.error("Rename failed:", e);
		}
	};

	const handleDelete = async (targetPath: string) => {
		const name = targetPath.replace(/\\/g, "/").split("/").pop();
		if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
		try {
			await invoke("explorer_delete", { targetPath });
			refresh();
		} catch (e) {
			console.error("Delete failed:", e);
		}
	};

	const handleNewItem = async (parent: string, name: string, type: "file" | "folder") => {
		setNewItem(null);
		const fullPath = joinPath(parent, name);
		try {
			if (type === "file") await invoke("explorer_new_file", { filePath: fullPath });
			else await invoke("explorer_new_folder", { dirPath: fullPath });
			refresh();
			// Open new file in editor
			if (type === "file" && onOpenFile) onOpenFile(fullPath);
		} catch (e) {
			console.error("Create failed:", e);
		}
	};

	const handleOpenExternal = (path: string) => {
		invoke("explorer_open_path", { targetPath: path }).catch(() => {});
	};

	// ─── Render ──────────────────────────────────────────────────────────────

	const filteredEntries = showHidden ? entries : entries.filter((e) => !e.isHidden);

	// Group search results by file
	const grouped = searchResults.reduce<Record<string, SearchResult[]>>((acc, r) => {
		if (!acc[r.filePath]) acc[r.filePath] = [];
		acc[r.filePath].push(r);
		return acc;
	}, {});
	const fileNameFromPath = (path: string) => path.replace(/\\/g, "/").split("/").pop() || path;
	const relativePath = (path: string) => {
		const normalized = path.replace(/\\/g, "/");
		const base = projectPath.replace(/\\/g, "/");
		return normalized.startsWith(base) ? normalized.slice(base.length + 1) : normalized;
	};

	return (
		<div className="flex flex-col h-full overflow-hidden">
			{/* Search bar */}
			<div className="px-2 pt-2 pb-1 border-b border-connexio-border flex-shrink-0">
				<div className="flex items-center gap-1 bg-connexio-bg-tertiary rounded px-2 py-1">
					<Search size={12} className="text-connexio-text-muted flex-shrink-0" />
					<input
						ref={searchInputRef}
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
						placeholder="Search in files..."
						className="flex-1 bg-transparent text-xs text-connexio-text outline-none placeholder:text-connexio-text-muted/50"
					/>
					{searchQuery && (
						<button onClick={clearSearch} className="p-0.5 rounded hover:bg-connexio-bg-secondary" type="button">
							<X size={10} className="text-connexio-text-muted" />
						</button>
					)}
				</div>
				{searchQuery && (
					<div className="flex items-center gap-2 mt-1">
						<label className="flex items-center gap-1 text-[10px] text-connexio-text-muted cursor-pointer">
							<input
								type="checkbox"
								checked={caseSensitive}
								onChange={(e) => setCaseSensitive(e.target.checked)}
								className="w-3 h-3 rounded border-connexio-border"
							/>
							Aa
						</label>
						<button
							onClick={handleSearch}
							disabled={!searchQuery.trim() || searching}
							className="ml-auto px-2 py-0.5 text-[10px] rounded bg-connexio-accent/10 text-connexio-accent hover:bg-connexio-accent/20 disabled:opacity-40 transition-colors"
							type="button"
						>
							{searching ? <Loader2 size={10} className="animate-spin" /> : "Search"}
						</button>
					</div>
				)}
			</div>

			{/* Search results */}
			{searched && (
				<div className="border-b border-connexio-border max-h-[40%] overflow-y-auto flex-shrink-0">
					{searching && (
						<div className="flex items-center justify-center py-4 text-connexio-text-muted">
							<Loader2 size={12} className="animate-spin mr-1.5" />
							<span className="text-[11px]">Searching...</span>
						</div>
					)}
					{!searching && searchResults.length === 0 && (
						<div className="px-3 py-3 text-center text-[11px] text-connexio-text-muted">No results</div>
					)}
					{!searching && searchResults.length > 0 && (
						<div className="py-1">
							<div className="px-2 py-0.5 text-[10px] text-connexio-text-muted">
								{searchResults.length} result{searchResults.length !== 1 ? "s" : ""} in {Object.keys(grouped).length} file{Object.keys(grouped).length !== 1 ? "s" : ""}
							</div>
							{Object.entries(grouped).map(([filePath, fileResults]) => (
								<div key={filePath} className="mb-0.5">
									<button
										onClick={() => onOpenFile?.(filePath)}
										className="w-full flex items-center gap-1.5 px-2 py-0.5 text-left hover:bg-connexio-bg-tertiary transition-colors"
										type="button"
									>
										<FileCode size={11} className="text-connexio-accent flex-shrink-0" />
										<span className="text-[11px] text-connexio-text font-medium truncate">{fileNameFromPath(filePath)}</span>
										<span className="text-[10px] text-connexio-text-muted truncate ml-1">{relativePath(filePath)}</span>
									</button>
									{fileResults.map((r) => (
										<button
											key={`${r.filePath}:${r.lineNumber}`}
											onClick={() => onOpenFile?.(r.filePath, r.lineNumber)}
											className="w-full flex items-start gap-2 px-4 py-0.5 text-left hover:bg-connexio-bg-tertiary transition-colors"
											type="button"
										>
											<span className="text-[10px] text-connexio-text-muted w-5 text-right flex-shrink-0 font-mono">{r.lineNumber}</span>
											<span className="text-[11px] text-connexio-text-secondary truncate font-mono">
												{highlightMatch(r.lineContent, searchQuery, caseSensitive)}
											</span>
										</button>
									))}
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{/* File tree header */}
			<div className="flex items-center justify-between px-3 py-1.5 border-b border-connexio-border flex-shrink-0">
				<span className="text-[10px] font-semibold uppercase tracking-wider text-connexio-text-muted">Files</span>
				<div className="flex items-center gap-1">
					<button onClick={() => setNewItem({ parent: projectPath, type: "file" })} className="p-0.5 rounded hover:bg-connexio-bg-tertiary" title="New File" type="button">
						<FilePlus size={12} className="text-connexio-text-muted" />
					</button>
					<button onClick={() => setNewItem({ parent: projectPath, type: "folder" })} className="p-0.5 rounded hover:bg-connexio-bg-tertiary" title="New Folder" type="button">
						<FolderPlus size={12} className="text-connexio-text-muted" />
					</button>
					<button onClick={refresh} className="p-0.5 rounded hover:bg-connexio-bg-tertiary" title="Refresh" type="button">
						<RefreshCw size={12} className="text-connexio-text-muted" />
					</button>
					<button onClick={() => setShowHidden(!showHidden)} className={`text-[10px] px-1 py-0.5 rounded ${showHidden ? "bg-connexio-accent/10 text-connexio-accent" : "text-connexio-text-muted"}`} title="Toggle hidden" type="button">
						.*
					</button>
				</div>
			</div>

			{/* New item at root level */}
			{newItem && newItem.parent === projectPath && (
				<div className="flex items-center gap-1 px-2 py-[3px]" style={{ paddingLeft: "8px" }}>
					<span className="w-3 flex-shrink-0" />
					{newItem.type === "folder"
						? <Folder size={14} className="text-connexio-accent/70 flex-shrink-0" />
						: <File size={14} className="text-connexio-text-muted flex-shrink-0" />}
					<InlineInput
						placeholder={newItem.type === "folder" ? "folder-name" : "filename.ext"}
						onConfirm={(val) => handleNewItem(projectPath, val, newItem.type)}
						onCancel={() => setNewItem(null)}
					/>
				</div>
			)}

			{/* Tree */}
			<div className="flex-1 overflow-y-auto py-1" onContextMenu={(e) => {
				e.preventDefault();
				// Right-click empty area = root context
				setContextMenu({ x: e.clientX, y: e.clientY, entry: { name: "", path: projectPath, isDir: true, isHidden: false, extension: null, size: null, children: null } });
			}}>
				{loading ? (
					<div className="text-[11px] text-connexio-text-muted px-3 py-2">Loading...</div>
				) : filteredEntries.length === 0 ? (
					<div className="text-[11px] text-connexio-text-muted px-3 py-2">Empty directory</div>
				) : (
					filteredEntries.map((entry) => (
						<FileTreeNode
							key={entry.path}
							entry={entry}
							depth={0}
							onOpenFile={onOpenFile}
							onContextMenu={(e, ent) => setContextMenu({ x: e.clientX, y: e.clientY, entry: ent })}
							renamingPath={renamingPath}
							onRenameConfirm={handleRename}
							newItem={newItem}
							onNewItemConfirm={handleNewItem}
							onNewItemCancel={() => setNewItem(null)}
							gitStatusMap={gitStatusMap}
							projectPath={projectPath}
						/>
					))
				)}
			</div>

			{/* Context Menu */}
			{contextMenu && (
				<ExplorerContextMenu
					x={contextMenu.x}
					y={contextMenu.y}
					isDir={contextMenu.entry.isDir}
					onClose={() => setContextMenu(null)}
					onRename={() => { setRenamingPath(contextMenu.entry.path); setContextMenu(null); }}
					onDelete={() => { handleDelete(contextMenu.entry.path); setContextMenu(null); }}
					onNewFile={() => { setNewItem({ parent: contextMenu.entry.isDir ? contextMenu.entry.path : projectPath, type: "file" }); setContextMenu(null); }}
					onNewFolder={() => { setNewItem({ parent: contextMenu.entry.isDir ? contextMenu.entry.path : projectPath, type: "folder" }); setContextMenu(null); }}
					onCopyPath={() => { navigator.clipboard.writeText(contextMenu.entry.path).catch(() => {}); setContextMenu(null); }}
					onOpenInTerminal={() => { onOpenInTerminal?.(contextMenu.entry.isDir ? contextMenu.entry.path : parentDir(contextMenu.entry.path)); setContextMenu(null); }}
					onOpenExternal={() => { handleOpenExternal(contextMenu.entry.path); setContextMenu(null); }}
					onOpenInSplitRight={!contextMenu.entry.isDir && onOpenFileInSplit ? () => { onOpenFileInSplit(contextMenu.entry.path, "horizontal"); setContextMenu(null); } : undefined}
					onOpenInSplitDown={!contextMenu.entry.isDir && onOpenFileInSplit ? () => { onOpenFileInSplit(contextMenu.entry.path, "vertical"); setContextMenu(null); } : undefined}
				/>
			)}
		</div>
	);
}
