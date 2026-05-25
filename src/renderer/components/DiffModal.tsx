import {
	ChevronLeft,
	ChevronRight,
	Columns2,
	Copy,
	ExternalLink,
	FileText,
	Loader2,
	Minus,
	Plus,
	Search,
	Undo2,
	WrapText,
	X,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GitChangedFile, GitDiffResult } from "../../shared/types";
import ConfirmDialog from "./ConfirmDialog";
import DiffViewer from "./DiffViewer";

export type DiffFileContext = {
	file: GitChangedFile;
	group: "staged" | "modified" | "untracked";
};

interface Props {
	projectPath: string;
	files: DiffFileContext[];
	initialIndex: number;
	onClose: () => void;
	onRefresh: () => void;
}

const MIN_FONT = 10;
const MAX_FONT = 20;

export default function DiffModal({
	projectPath,
	files,
	initialIndex,
	onClose,
	onRefresh,
}: Props) {
	const [currentIndex, setCurrentIndex] = useState(initialIndex);
	const [diff, setDiff] = useState<GitDiffResult | null>(null);
	const [loading, setLoading] = useState(true);
	const [view, setView] = useState<"unified" | "split">("unified");
	const [wrapLines, setWrapLines] = useState(false);
	const [fontSize, setFontSize] = useState(12);
	const [showSearch, setShowSearch] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [discardConfirm, setDiscardConfirm] = useState(false);

	const searchInputRef = useRef<HTMLInputElement>(null);
	const scrollRef = useRef<HTMLDivElement>(null);

	const current = files[currentIndex];

	// Load diff for current file
	const loadDiff = useCallback(async () => {
		if (!current) return;
		setLoading(true);
		setDiff(null);
		try {
			let result: GitDiffResult;
			if (current.group === "untracked") {
				result = await window.connexio.git.diffUntracked(
					projectPath,
					current.file.path,
				);
			} else {
				result = await window.connexio.git.diff(
					projectPath,
					current.file.path,
					current.group === "staged",
				);
			}
			setDiff(result);
		} catch {
			setDiff(null);
		}
		setLoading(false);
		// Scroll to top when navigating
		if (scrollRef.current) {
			scrollRef.current.scrollTop = 0;
		}
	}, [current, projectPath]);

	useEffect(() => {
		loadDiff();
	}, [loadDiff]);

	// Keyboard shortcuts
	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			// Allow typing in search input
			if (document.activeElement === searchInputRef.current) {
				if (e.key === "Escape") {
					e.preventDefault();
					setShowSearch(false);
					setSearchQuery("");
				}
				return;
			}

			if (e.key === "Escape") {
				e.preventDefault();
				onClose();
			} else if (e.key === "ArrowLeft" && (e.altKey || e.metaKey)) {
				e.preventDefault();
				goToPrev();
			} else if (e.key === "ArrowRight" && (e.altKey || e.metaKey)) {
				e.preventDefault();
				goToNext();
			} else if ((e.ctrlKey || e.metaKey) && e.key === "f") {
				e.preventDefault();
				setShowSearch(true);
				setTimeout(() => searchInputRef.current?.focus(), 0);
			} else if ((e.ctrlKey || e.metaKey) && e.key === "=") {
				e.preventDefault();
				setFontSize((f) => Math.min(MAX_FONT, f + 1));
			} else if ((e.ctrlKey || e.metaKey) && e.key === "-") {
				e.preventDefault();
				setFontSize((f) => Math.max(MIN_FONT, f - 1));
			}
		};
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentIndex, files.length, onClose]);

	const goToPrev = () => {
		if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
	};

	const goToNext = () => {
		if (currentIndex < files.length - 1) setCurrentIndex(currentIndex + 1);
	};

	const handleCopy = () => {
		if (!diff) return;
		const text = diff.hunks
			.map((h) => {
				const header = h.header;
				const lines = h.lines
					.map((l) => {
						const prefix =
							l.type === "add" ? "+" : l.type === "remove" ? "-" : " ";
						return prefix + l.content;
					})
					.join("\n");
				return `${header}\n${lines}`;
			})
			.join("\n");
		navigator.clipboard.writeText(text);
	};

	const handleOpenInEditor = async () => {
		if (!current) return;
		await window.connexio.git.openFile(projectPath, current.file.path);
	};

	const handleStage = async () => {
		if (!current) return;
		await window.connexio.git.stage(projectPath, current.file.path);
		onRefresh();
	};

	const handleUnstage = async () => {
		if (!current) return;
		await window.connexio.git.unstage(projectPath, current.file.path);
		onRefresh();
	};

	const handleDiscard = async () => {
		if (!current) return;
		await window.connexio.git.discard(projectPath, current.file.path);
		setDiscardConfirm(false);
		onRefresh();
		// After discard the file is gone — navigate or close
		if (files.length <= 1) {
			onClose();
		} else if (currentIndex >= files.length - 1) {
			setCurrentIndex(Math.max(0, currentIndex - 1));
		}
	};

	if (!current) {
		return null;
	}

	// Stats
	const addCount =
		diff?.hunks.reduce(
			(acc, h) => acc + h.lines.filter((l) => l.type === "add").length,
			0,
		) ?? 0;
	const removeCount =
		diff?.hunks.reduce(
			(acc, h) => acc + h.lines.filter((l) => l.type === "remove").length,
			0,
		) ?? 0;

	return (
		<>
			<div
				className="fixed inset-0 z-50 bg-[#050607]/95 flex items-center justify-center p-3 animate-[fadeIn_120ms_ease-out]"
				onClick={onClose}
				onKeyDown={(e) => {
					if (e.key === "Escape") onClose();
				}}
				role="dialog"
				aria-modal="true"
			>
				<div
					className="bg-connexio-bg-primary border border-connexio-border rounded-lg shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.65)] w-full h-full max-w-[1600px] max-h-[96vh] flex flex-col overflow-hidden"
					onClick={(e) => e.stopPropagation()}
					onKeyDown={(e) => e.stopPropagation()}
					role="document"
				>
					{/* Header */}
					<div className="flex items-center gap-2 px-3 py-2 border-b border-connexio-border bg-connexio-bg-primary flex-shrink-0">
						{/* File info */}
						<FileText
							size={14}
							className="text-connexio-text-muted flex-shrink-0"
						/>
						<div className="flex-1 min-w-0 flex items-baseline gap-2">
							<span className="text-xs font-medium text-connexio-text truncate">
								{current.file.path}
							</span>
							<span
								className={`text-[10px] font-mono px-1.5 rounded flex-shrink-0 ${
									current.group === "staged"
										? "text-green-400 bg-green-400/10"
										: current.group === "untracked"
											? "text-blue-400 bg-blue-400/10"
											: "text-yellow-400 bg-yellow-400/10"
								}`}
							>
								{current.group}
							</span>
							{!loading && diff && !diff.isBinary && !diff.isTooLarge && (
								<span className="text-[10px] text-connexio-text-muted flex-shrink-0 flex items-center gap-1.5">
									<span className="text-green-400">+{addCount}</span>
									<span className="text-red-400">−{removeCount}</span>
								</span>
							)}
						</div>

						{/* File navigation */}
						<div className="flex items-center gap-0.5 text-[10px] text-connexio-text-muted flex-shrink-0">
							<button
								onClick={goToPrev}
								disabled={currentIndex === 0}
								className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
								title="Previous file (Alt+←)"
								type="button"
							>
								<ChevronLeft size={13} />
							</button>
							<span className="px-1 tabular-nums">
								{currentIndex + 1} / {files.length}
							</span>
							<button
								onClick={goToNext}
								disabled={currentIndex >= files.length - 1}
								className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
								title="Next file (Alt+→)"
								type="button"
							>
								<ChevronRight size={13} />
							</button>
						</div>

						<div className="w-px h-4 bg-connexio-border" />

						{/* Close */}
						<button
							onClick={onClose}
							className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
							title="Close (Esc)"
							type="button"
						>
							<X size={14} className="text-connexio-text-muted" />
						</button>
					</div>

					{/* Toolbar */}
					<div className="flex items-center gap-1 px-3 py-1.5 border-b border-connexio-border bg-connexio-bg-primary flex-shrink-0">
						{/* View toggle */}
						<div className="flex items-center rounded border border-connexio-border overflow-hidden">
							<button
								onClick={() => setView("unified")}
								className={`flex items-center gap-1 px-2 py-1 text-[10px] transition-colors ${
									view === "unified"
										? "bg-connexio-accent/15 text-connexio-accent"
										: "text-connexio-text-muted hover:bg-connexio-bg-tertiary"
								}`}
								type="button"
								title="Unified view"
							>
								<FileText size={11} />
								Unified
							</button>
							<button
								onClick={() => setView("split")}
								className={`flex items-center gap-1 px-2 py-1 text-[10px] transition-colors border-l border-connexio-border ${
									view === "split"
										? "bg-connexio-accent/15 text-connexio-accent"
										: "text-connexio-text-muted hover:bg-connexio-bg-tertiary"
								}`}
								type="button"
								title="Split view"
							>
								<Columns2 size={11} />
								Split
							</button>
						</div>

						{/* Wrap toggle */}
						<button
							onClick={() => setWrapLines(!wrapLines)}
							className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded border transition-colors ${
								wrapLines
									? "bg-connexio-accent/15 text-connexio-accent border-connexio-accent/40"
									: "text-connexio-text-muted hover:bg-connexio-bg-tertiary border-connexio-border"
							}`}
							type="button"
							title="Toggle line wrap"
						>
							<WrapText size={11} />
						</button>

						{/* Font size */}
						<div className="flex items-center rounded border border-connexio-border overflow-hidden">
							<button
								onClick={() =>
									setFontSize((f) => Math.max(MIN_FONT, f - 1))
								}
								disabled={fontSize <= MIN_FONT}
								className="px-1.5 py-1 text-connexio-text-muted hover:bg-connexio-bg-tertiary transition-colors disabled:opacity-30"
								type="button"
								title="Decrease font size (Ctrl/Cmd -)"
							>
								<ZoomOut size={11} />
							</button>
							<span className="px-1.5 text-[10px] text-connexio-text-muted tabular-nums">
								{fontSize}
							</span>
							<button
								onClick={() =>
									setFontSize((f) => Math.min(MAX_FONT, f + 1))
								}
								disabled={fontSize >= MAX_FONT}
								className="px-1.5 py-1 text-connexio-text-muted hover:bg-connexio-bg-tertiary transition-colors disabled:opacity-30"
								type="button"
								title="Increase font size (Ctrl/Cmd =)"
							>
								<ZoomIn size={11} />
							</button>
						</div>

						{/* Search */}
						<button
							onClick={() => {
								setShowSearch(!showSearch);
								if (!showSearch) {
									setTimeout(() => searchInputRef.current?.focus(), 0);
								} else {
									setSearchQuery("");
								}
							}}
							className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded border transition-colors ${
								showSearch
									? "bg-connexio-accent/15 text-connexio-accent border-connexio-accent/40"
									: "text-connexio-text-muted hover:bg-connexio-bg-tertiary border-connexio-border"
							}`}
							type="button"
							title="Search in diff (Ctrl/Cmd F)"
						>
							<Search size={11} />
						</button>

						<div className="flex-1" />

						{/* Actions */}
						<button
							onClick={handleCopy}
							className="flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-connexio-border text-connexio-text-muted hover:bg-connexio-bg-tertiary transition-colors"
							type="button"
							title="Copy diff to clipboard"
						>
							<Copy size={11} />
							Copy
						</button>
						<button
							onClick={handleOpenInEditor}
							className="flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-connexio-border text-connexio-text-muted hover:bg-connexio-bg-tertiary transition-colors"
							type="button"
							title="Open file in default editor"
						>
							<ExternalLink size={11} />
							Open
						</button>

						<div className="w-px h-4 bg-connexio-border mx-1" />

						{current.group === "staged" ? (
							<button
								onClick={handleUnstage}
								className="flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10 transition-colors"
								type="button"
							>
								<Minus size={11} />
								Unstage
							</button>
						) : (
							<>
								<button
									onClick={handleStage}
									className="flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-green-400/30 text-green-400 hover:bg-green-400/10 transition-colors"
									type="button"
								>
									<Plus size={11} />
									Stage
								</button>
								<button
									onClick={() => setDiscardConfirm(true)}
									className="flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-colors"
									type="button"
								>
									<Undo2 size={11} />
									Discard
								</button>
							</>
						)}
					</div>

					{/* Search bar */}
					{showSearch && (
						<div className="flex items-center gap-2 px-3 py-1.5 border-b border-connexio-border bg-connexio-bg-primary flex-shrink-0">
							<Search
								size={11}
								className="text-connexio-text-muted flex-shrink-0"
							/>
							<input
								ref={searchInputRef}
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search in this diff..."
								className="flex-1 bg-transparent text-xs text-connexio-text outline-none placeholder:text-connexio-text-muted"
							/>
							<button
								onClick={() => {
									setShowSearch(false);
									setSearchQuery("");
								}}
								className="p-0.5 rounded hover:bg-connexio-bg-tertiary transition-colors"
								type="button"
							>
								<X size={11} className="text-connexio-text-muted" />
							</button>
						</div>
					)}

					{/* Diff body */}
					<div
						ref={scrollRef}
						className="flex-1 overflow-auto bg-connexio-bg-primary"
					>
						{loading ? (
							<div className="flex items-center justify-center py-12 gap-2 text-connexio-text-muted">
								<Loader2 size={14} className="animate-spin" />
								<span className="text-xs">Loading diff...</span>
							</div>
						) : diff ? (
							<DiffViewer
								diff={diff}
								view={view}
								wrapLines={wrapLines}
								searchQuery={searchQuery}
								fontSize={fontSize}
							/>
						) : (
							<div className="flex items-center justify-center py-12 text-xs text-connexio-text-muted italic">
								Unable to load diff
							</div>
						)}
					</div>

					{/* Footer / Status bar */}
					<div className="flex items-center gap-3 px-3 py-1 border-t border-connexio-border bg-connexio-bg-secondary flex-shrink-0 text-[10px] text-connexio-text-muted">
						<span>
							<kbd className="px-1 rounded bg-connexio-bg-tertiary">Esc</kbd>{" "}
							close
						</span>
						<span>
							<kbd className="px-1 rounded bg-connexio-bg-tertiary">Alt+←/→</kbd>{" "}
							navigate
						</span>
						<span>
							<kbd className="px-1 rounded bg-connexio-bg-tertiary">Ctrl+F</kbd>{" "}
							search
						</span>
						<span>
							<kbd className="px-1 rounded bg-connexio-bg-tertiary">Ctrl +/-</kbd>{" "}
							zoom
						</span>
						{diff?.language && diff.language !== "plaintext" && (
							<span className="ml-auto">
								Language:{" "}
								<span className="text-connexio-accent">{diff.language}</span>
							</span>
						)}
					</div>
				</div>
			</div>

			{/* Discard confirmation */}
			{discardConfirm && (
				<ConfirmDialog
					title="Discard Changes"
					message={`Discard all changes to "${current.file.path}"? This cannot be undone.`}
					confirmLabel="Discard"
					cancelLabel="Cancel"
					variant="danger"
					onConfirm={handleDiscard}
					onCancel={() => setDiscardConfirm(false)}
				/>
			)}
		</>
	);
}
