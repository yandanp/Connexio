import { memo, useEffect, useMemo, useState } from "react";
import type {
	GitDiffHunk,
	GitDiffLine,
	GitDiffResult,
} from "../../shared/types";

// ============================================
// Lazy-loaded Syntax Highlighter
// ============================================

// Cache the loaded hljs instance
type HljsModule = typeof import("highlight.js/lib/common").default;
let hljsInstance: HljsModule | null = null;
let hljsLoading: Promise<HljsModule> | null = null;

async function loadHljs(): Promise<HljsModule> {
	if (hljsInstance) return hljsInstance;
	if (hljsLoading) return hljsLoading;
	hljsLoading = import("highlight.js/lib/common").then((mod) => {
		hljsInstance = mod.default;
		return mod.default;
	});
	return hljsLoading;
}

function escapeHtml(str: string): string {
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Constants for performance guards
const MAX_HIGHLIGHT_LINE_LENGTH = 500; // Skip hljs for very long lines
const HIGHLIGHT_DEBOUNCE_THRESHOLD = 100; // Lines above this count → async highlight

function highlightLineSync(
	code: string,
	language: string | undefined,
	hljs: HljsModule | null,
): string {
	if (!code) return "";
	// Guard: skip highlighting if hljs not loaded, no language, or line too long
	if (
		!hljs ||
		!language ||
		language === "plaintext" ||
		code.length > MAX_HIGHLIGHT_LINE_LENGTH
	) {
		return escapeHtml(code);
	}
	try {
		if (hljs.getLanguage(language)) {
			return hljs.highlight(code, { language, ignoreIllegals: true }).value;
		}
	} catch {
		// fall through
	}
	return escapeHtml(code);
}

// ============================================
// Props
// ============================================

export interface DiffViewerProps {
	diff: GitDiffResult;
	view: "unified" | "split";
	wrapLines?: boolean;
	searchQuery?: string;
	fontSize?: number;
	/** Limit total rendered lines. Useful for inline previews. */
	maxLines?: number;
	/** Show CTA when content is truncated by maxLines */
	onRequestFullView?: () => void;
}

// ============================================
// Main DiffViewer
// ============================================

export default function DiffViewer({
	diff,
	view,
	wrapLines = false,
	searchQuery = "",
	fontSize = 12,
	maxLines,
	onRequestFullView,
}: DiffViewerProps) {
	const [hljs, setHljs] = useState<HljsModule | null>(hljsInstance);

	// Lazy-load hljs only when a diff is actually being viewed and language is known
	useEffect(() => {
		if (
			hljsInstance ||
			!diff.language ||
			diff.language === "plaintext" ||
			diff.isBinary ||
			diff.isTooLarge
		) {
			return;
		}
		let cancelled = false;
		loadHljs().then((mod) => {
			if (!cancelled) setHljs(mod);
		});
		return () => {
			cancelled = true;
		};
	}, [diff.language, diff.isBinary, diff.isTooLarge]);

	// Apply maxLines limit — must be before early returns to satisfy hooks order
	const { limitedHunks, wasLimited } = useMemo(
		() => applyLineLimit(diff.hunks, maxLines),
		[diff.hunks, maxLines],
	);

	// Handle empty / special states
	if (diff.isBinary) {
		return (
			<EmptyState
				title="Binary file"
				message={`${diff.file}${diff.fileSize ? ` (${formatSize(diff.fileSize)})` : ""}`}
				hint="Binary files cannot be displayed as text diff"
			/>
		);
	}

	if (diff.isTooLarge) {
		return (
			<EmptyState
				title="File too large"
				message={`${diff.file}${diff.fileSize ? ` (${formatSize(diff.fileSize)})` : ""}`}
				hint="Diffs larger than 1MB are not displayed for performance. Open the file in your editor to view it."
			/>
		);
	}

	if (!diff.hunks.length) {
		return <EmptyState title="No changes" message="No differences to display" />;
	}

	// Disable syntax highlighting for huge diffs to keep render cheap
	const totalLines = limitedHunks.reduce((n, h) => n + h.lines.length, 0);
	const shouldHighlight = hljs && totalLines <= 2000;

	const Body = view === "split" ? SplitDiffView : UnifiedDiffView;

	return (
		<div
			className="font-mono leading-[1.5]"
			style={{ fontSize: `${fontSize}px` }}
		>
			<Body
				hunks={limitedHunks}
				language={diff.language}
				wrapLines={wrapLines}
				searchQuery={searchQuery}
				hljs={shouldHighlight ? hljs : null}
			/>
			{wasLimited && (
				<TruncatedPreviewNotice onRequestFullView={onRequestFullView} />
			)}
			{diff.truncated && !wasLimited && <TruncatedNotice />}
		</div>
	);
}

// Limit total lines across hunks
function applyLineLimit(
	hunks: GitDiffHunk[],
	maxLines?: number,
): { limitedHunks: GitDiffHunk[]; wasLimited: boolean } {
	if (!maxLines) return { limitedHunks: hunks, wasLimited: false };

	let remaining = maxLines;
	const result: GitDiffHunk[] = [];
	let wasLimited = false;

	for (const hunk of hunks) {
		if (remaining <= 0) {
			wasLimited = true;
			break;
		}
		if (hunk.lines.length <= remaining) {
			result.push(hunk);
			remaining -= hunk.lines.length;
		} else {
			result.push({
				header: hunk.header,
				lines: hunk.lines.slice(0, remaining),
			});
			remaining = 0;
			wasLimited = true;
		}
	}

	return { limitedHunks: result, wasLimited };
}

// ============================================
// Unified View
// ============================================

interface ViewProps {
	hunks: GitDiffHunk[];
	language?: string;
	wrapLines: boolean;
	searchQuery: string;
	hljs: HljsModule | null;
}

function UnifiedDiffView({
	hunks,
	language,
	wrapLines,
	searchQuery,
	hljs,
}: ViewProps) {
	return (
		<>
			{hunks.map((hunk, i) => (
				<UnifiedHunk
					key={i}
					hunk={hunk}
					language={language}
					wrapLines={wrapLines}
					searchQuery={searchQuery}
					hljs={hljs}
				/>
			))}
		</>
	);
}

function UnifiedHunk({
	hunk,
	language,
	wrapLines,
	searchQuery,
	hljs,
}: {
	hunk: GitDiffHunk;
	language?: string;
	wrapLines: boolean;
	searchQuery: string;
	hljs: HljsModule | null;
}) {
	return (
		<div>
			<div className="px-3 py-1 bg-connexio-bg-tertiary/60 text-connexio-text-muted border-y border-connexio-border sticky top-0 z-10 text-[10px] select-text">
				{hunk.header}
			</div>
			{hunk.lines.map((line, i) => (
				<UnifiedLine
					key={i}
					line={line}
					language={language}
					wrapLines={wrapLines}
					searchQuery={searchQuery}
					hljs={hljs}
				/>
			))}
		</div>
	);
}

interface UnifiedLineProps {
	line: GitDiffLine;
	language?: string;
	wrapLines: boolean;
	searchQuery: string;
	hljs: HljsModule | null;
}

const UnifiedLine = memo(function UnifiedLine({
	line,
	language,
	wrapLines,
	searchQuery,
	hljs,
}: UnifiedLineProps) {
	const bgClass =
		line.type === "add"
			? "bg-green-500/[0.08]"
			: line.type === "remove"
				? "bg-red-500/[0.08]"
				: "";

	const prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
	const prefixColor =
		line.type === "add"
			? "text-green-400"
			: line.type === "remove"
				? "text-red-400"
				: "text-connexio-text-muted/50";

	const highlighted = useMemo(
		() => highlightLineSync(line.content, language, hljs),
		[line.content, language, hljs],
	);

	const content = useMemo(() => {
		if (!searchQuery) return highlighted;
		return highlightSearch(highlighted, searchQuery);
	}, [highlighted, searchQuery]);

	return (
		<div className={`flex ${bgClass}`}>
			<span className="w-12 text-right px-2 text-connexio-text-muted/40 select-none flex-shrink-0 border-r border-connexio-border/20 text-[10px]">
				{line.oldLineNo ?? ""}
			</span>
			<span className="w-12 text-right px-2 text-connexio-text-muted/40 select-none flex-shrink-0 border-r border-connexio-border/20 text-[10px]">
				{line.newLineNo ?? ""}
			</span>
			<span
				className={`w-5 text-center select-none flex-shrink-0 ${prefixColor}`}
			>
				{prefix}
			</span>
			<code
				className={`flex-1 px-2 hljs-line ${wrapLines ? "whitespace-pre-wrap break-all" : "whitespace-pre"} text-connexio-text`}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: syntax highlighting needs HTML
				dangerouslySetInnerHTML={{ __html: content || "&nbsp;" }}
			/>
		</div>
	);
});

// ============================================
// Split View
// ============================================

interface SplitPair {
	left: GitDiffLine | null;
	right: GitDiffLine | null;
}

function pairLines(lines: GitDiffLine[]): SplitPair[] {
	const pairs: SplitPair[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		if (line.type === "context") {
			pairs.push({ left: line, right: line });
			i++;
			continue;
		}

		const removes: GitDiffLine[] = [];
		const adds: GitDiffLine[] = [];

		while (i < lines.length && lines[i].type === "remove") {
			removes.push(lines[i]);
			i++;
		}
		while (i < lines.length && lines[i].type === "add") {
			adds.push(lines[i]);
			i++;
		}

		const maxLen = Math.max(removes.length, adds.length);
		for (let j = 0; j < maxLen; j++) {
			pairs.push({
				left: removes[j] || null,
				right: adds[j] || null,
			});
		}
	}

	return pairs;
}

function SplitDiffView({
	hunks,
	language,
	wrapLines,
	searchQuery,
	hljs,
}: ViewProps) {
	return (
		<>
			{hunks.map((hunk, i) => (
				<SplitHunk
					key={i}
					hunk={hunk}
					language={language}
					wrapLines={wrapLines}
					searchQuery={searchQuery}
					hljs={hljs}
				/>
			))}
		</>
	);
}

function SplitHunk({
	hunk,
	language,
	wrapLines,
	searchQuery,
	hljs,
}: {
	hunk: GitDiffHunk;
	language?: string;
	wrapLines: boolean;
	searchQuery: string;
	hljs: HljsModule | null;
}) {
	const pairs = useMemo(() => pairLines(hunk.lines), [hunk.lines]);

	return (
		<div>
			<div className="px-3 py-1 bg-connexio-bg-tertiary/60 text-connexio-text-muted border-y border-connexio-border sticky top-0 z-10 text-[10px] select-text">
				{hunk.header}
			</div>
			{pairs.map((pair, i) => (
				<SplitRow
					key={i}
					pair={pair}
					language={language}
					wrapLines={wrapLines}
					searchQuery={searchQuery}
					hljs={hljs}
				/>
			))}
		</div>
	);
}

const SplitRow = memo(function SplitRow({
	pair,
	language,
	wrapLines,
	searchQuery,
	hljs,
}: {
	pair: SplitPair;
	language?: string;
	wrapLines: boolean;
	searchQuery: string;
	hljs: HljsModule | null;
}) {
	return (
		<div className="flex">
			<SplitSide
				line={pair.left}
				side="left"
				language={language}
				wrapLines={wrapLines}
				searchQuery={searchQuery}
				hljs={hljs}
			/>
			<div className="w-px bg-connexio-border flex-shrink-0" />
			<SplitSide
				line={pair.right}
				side="right"
				language={language}
				wrapLines={wrapLines}
				searchQuery={searchQuery}
				hljs={hljs}
			/>
		</div>
	);
});

function SplitSide({
	line,
	side,
	language,
	wrapLines,
	searchQuery,
	hljs,
}: {
	line: GitDiffLine | null;
	side: "left" | "right";
	language?: string;
	wrapLines: boolean;
	searchQuery: string;
	hljs: HljsModule | null;
}) {
	const highlighted = useMemo(
		() => (line ? highlightLineSync(line.content, language, hljs) : ""),
		[line, language, hljs],
	);

	const content = useMemo(() => {
		if (!line || !searchQuery) return highlighted;
		return highlightSearch(highlighted, searchQuery);
	}, [highlighted, line, searchQuery]);

	if (!line) {
		return (
			<div className="flex-1 min-w-0 bg-connexio-bg-tertiary/20 flex">
				<span className="w-10 flex-shrink-0 border-r border-connexio-border/20" />
				<span className="flex-1 px-2" />
			</div>
		);
	}

	let bgClass = "";
	if (side === "left" && line.type === "remove") {
		bgClass = "bg-red-500/[0.08]";
	} else if (side === "right" && line.type === "add") {
		bgClass = "bg-green-500/[0.08]";
	}

	const lineNo = side === "left" ? line.oldLineNo : line.newLineNo;

	return (
		<div className={`flex-1 min-w-0 flex ${bgClass}`}>
			<span className="w-10 text-right px-2 text-connexio-text-muted/40 select-none flex-shrink-0 border-r border-connexio-border/20 text-[10px]">
				{lineNo ?? ""}
			</span>
			<code
				className={`flex-1 px-2 min-w-0 ${wrapLines ? "whitespace-pre-wrap break-all" : "whitespace-pre overflow-x-auto"} text-connexio-text`}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: syntax highlighting needs HTML
				dangerouslySetInnerHTML={{ __html: content || "&nbsp;" }}
			/>
		</div>
	);
}

// ============================================
// Shared Components
// ============================================

function EmptyState({
	title,
	message,
	hint,
}: {
	title: string;
	message: string;
	hint?: string;
}) {
	return (
		<div className="flex flex-col items-center justify-center py-12 px-6 text-center">
			<p className="text-sm font-medium text-connexio-text mb-1">{title}</p>
			<p className="text-xs text-connexio-text-muted mb-2 break-all">
				{message}
			</p>
			{hint && (
				<p className="text-[11px] text-connexio-text-muted/60 max-w-sm">
					{hint}
				</p>
			)}
		</div>
	);
}

function TruncatedNotice() {
	return (
		<div className="px-3 py-2 text-[11px] text-yellow-400/80 bg-yellow-500/5 border-t border-yellow-500/20 italic">
			Diff truncated — file has more changes than can be displayed
		</div>
	);
}

function TruncatedPreviewNotice({
	onRequestFullView,
}: {
	onRequestFullView?: () => void;
}) {
	return (
		<div className="px-3 py-2 text-[11px] text-connexio-text-muted bg-connexio-bg-tertiary/40 border-t border-connexio-border italic flex items-center justify-between gap-2">
			<span>Preview limited for performance</span>
			{onRequestFullView && (
				<button
					onClick={onRequestFullView}
					className="text-connexio-accent hover:underline flex-shrink-0"
					type="button"
				>
					Open full diff →
				</button>
			)}
		</div>
	);
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Highlight search matches inside already-highlighted HTML
// Safe because we only wrap text nodes between HTML tags
function highlightSearch(html: string, query: string): string {
	if (!query) return html;
	const lowerQuery = query.toLowerCase();

	let result = "";
	let inTag = false;
	let textBuffer = "";

	const flushBuffer = () => {
		if (!textBuffer) return;
		const lowerText = textBuffer.toLowerCase();
		let out = "";
		let i = 0;
		while (i < textBuffer.length) {
			const idx = lowerText.indexOf(lowerQuery, i);
			if (idx === -1) {
				out += textBuffer.slice(i);
				break;
			}
			out += textBuffer.slice(i, idx);
			out += `<mark class="bg-yellow-400/40 text-white rounded-sm">${textBuffer.slice(idx, idx + query.length)}</mark>`;
			i = idx + query.length;
		}
		result += out;
		textBuffer = "";
	};

	for (let i = 0; i < html.length; i++) {
		const ch = html[i];
		if (ch === "<") {
			flushBuffer();
			inTag = true;
			result += ch;
		} else if (ch === ">") {
			inTag = false;
			result += ch;
		} else if (inTag) {
			result += ch;
		} else {
			textBuffer += ch;
		}
	}
	flushBuffer();
	return result;
}
