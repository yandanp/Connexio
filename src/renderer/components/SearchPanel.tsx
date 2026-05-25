import { FileCode, Loader2, Search, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface SearchResult {
	filePath: string;
	lineNumber: number;
	lineContent: string;
}

interface Props {
	projectPath: string;
	onOpenFile: (filePath: string, lineNumber?: number) => void;
}

export default function SearchPanel({ projectPath, onOpenFile }: Props) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<SearchResult[]>([]);
	const [searching, setSearching] = useState(false);
	const [caseSensitive, setCaseSensitive] = useState(false);
	const [searched, setSearched] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const abortRef = useRef(false);

	const handleSearch = useCallback(async () => {
		const trimmed = query.trim();
		if (!trimmed) return;

		abortRef.current = false;
		setSearching(true);
		setSearched(true);
		try {
			const res = await invoke<SearchResult[]>("explorer_search_in_files", {
				projectPath,
				query: trimmed,
				caseSensitive,
				maxResults: 200,
			});
			if (!abortRef.current) {
				setResults(res);
			}
		} catch (e) {
			console.error("Search failed:", e);
			setResults([]);
		}
		setSearching(false);
	}, [query, projectPath, caseSensitive]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSearch();
		}
	};

	const handleClear = () => {
		setQuery("");
		setResults([]);
		setSearched(false);
		inputRef.current?.focus();
	};

	// Group results by file
	const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
		if (!acc[r.filePath]) acc[r.filePath] = [];
		acc[r.filePath].push(r);
		return acc;
	}, {});

	const fileName = (path: string) => path.replace(/\\/g, "/").split("/").pop() || path;
	const relativePath = (path: string) => {
		const normalized = path.replace(/\\/g, "/");
		const base = projectPath.replace(/\\/g, "/");
		return normalized.startsWith(base) ? normalized.slice(base.length + 1) : normalized;
	};

	return (
		<div className="flex flex-col h-full">
			{/* Search input */}
			<div className="p-2 border-b border-connexio-border">
				<div className="flex items-center gap-1 bg-connexio-bg-tertiary rounded px-2 py-1">
					<Search size={12} className="text-connexio-text-muted flex-shrink-0" />
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Search in files..."
						className="flex-1 bg-transparent text-xs text-connexio-text outline-none placeholder:text-connexio-text-muted/50"
					/>
					{query && (
						<button onClick={handleClear} className="p-0.5 rounded hover:bg-connexio-bg-secondary" type="button">
							<X size={10} className="text-connexio-text-muted" />
						</button>
					)}
				</div>
				<div className="flex items-center gap-2 mt-1.5">
					<label className="flex items-center gap-1 text-[10px] text-connexio-text-muted cursor-pointer">
						<input
							type="checkbox"
							checked={caseSensitive}
							onChange={(e) => setCaseSensitive(e.target.checked)}
							className="w-3 h-3 rounded border-connexio-border"
						/>
						Case sensitive
					</label>
					<button
						onClick={handleSearch}
						disabled={!query.trim() || searching}
						className="ml-auto px-2 py-0.5 text-[10px] rounded bg-connexio-accent/10 text-connexio-accent hover:bg-connexio-accent/20 disabled:opacity-40 transition-colors"
						type="button"
					>
						{searching ? <Loader2 size={10} className="animate-spin" /> : "Search"}
					</button>
				</div>
			</div>

			{/* Results */}
			<div className="flex-1 overflow-y-auto">
				{searching && (
					<div className="flex items-center justify-center py-8 text-connexio-text-muted">
						<Loader2 size={14} className="animate-spin mr-2" />
						<span className="text-xs">Searching...</span>
					</div>
				)}

				{!searching && searched && results.length === 0 && (
					<div className="px-3 py-6 text-center text-xs text-connexio-text-muted">
						No results found
					</div>
				)}

				{!searching && results.length > 0 && (
					<div className="py-1">
						<div className="px-2 py-1 text-[10px] text-connexio-text-muted">
							{results.length} result{results.length !== 1 ? "s" : ""} in {Object.keys(grouped).length} file{Object.keys(grouped).length !== 1 ? "s" : ""}
						</div>
						{Object.entries(grouped).map(([filePath, fileResults]) => (
							<div key={filePath} className="mb-1">
								{/* File header */}
								<button
									onClick={() => onOpenFile(filePath)}
									className="w-full flex items-center gap-1.5 px-2 py-1 text-left hover:bg-connexio-bg-tertiary transition-colors"
									type="button"
								>
									<FileCode size={11} className="text-connexio-accent flex-shrink-0" />
									<span className="text-[11px] text-connexio-text font-medium truncate">
										{fileName(filePath)}
									</span>
									<span className="text-[10px] text-connexio-text-muted truncate ml-1">
										{relativePath(filePath)}
									</span>
								</button>
								{/* Line results */}
								{fileResults.map((r) => (
									<button
										key={`${r.filePath}:${r.lineNumber}`}
										onClick={() => onOpenFile(r.filePath, r.lineNumber)}
										className="w-full flex items-start gap-2 px-4 py-0.5 text-left hover:bg-connexio-bg-tertiary transition-colors"
										type="button"
									>
										<span className="text-[10px] text-connexio-text-muted w-6 text-right flex-shrink-0 font-mono">
											{r.lineNumber}
										</span>
										<span className="text-[11px] text-connexio-text-secondary truncate font-mono">
											{highlightMatch(r.lineContent, query, caseSensitive)}
										</span>
									</button>
								))}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

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
					<span key={i} className="bg-connexio-accent/30 text-connexio-accent font-semibold">
						{part}
					</span>
				) : (
					<span key={i}>{part}</span>
				);
			})}
		</>
	);
}
