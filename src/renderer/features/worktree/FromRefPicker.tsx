import { ChevronDown, GitBranch, Loader2, Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { GitBranchEntry } from "../../../shared/types";

interface Props {
	branches: GitBranchEntry[] | null;
	fromRef: string;
	onSelect: (ref: string) => void;
}

/**
 * Orca-style "Start From" picker: searchable branch list with a HEAD fast
 * path, current/remote markers, and free-form ref entry for SHAs.
 */
export default function FromRefPicker({ branches, fromRef, onSelect }: Props) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	const filtered = useMemo(() => {
		if (!branches) return [];
		const q = query.trim().toLowerCase();
		return q ? branches.filter((b) => b.name.toLowerCase().includes(q)) : branches;
	}, [branches, query]);

	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex w-full items-center gap-2 rounded-lg border border-connexio-border bg-connexio-bg px-3 py-2 text-left text-xs text-connexio-text hover:border-connexio-accent/50 transition-colors"
			>
				<GitBranch size={12} className="flex-shrink-0 text-connexio-text-muted" />
				<span className="flex-1 truncate font-mono">{fromRef}</span>
				<ChevronDown size={12} className="flex-shrink-0 text-connexio-text-muted" />
			</button>

			{open && (
				<div className="absolute top-9 left-0 z-10 w-full rounded-lg border border-connexio-border bg-connexio-bg-secondary shadow-2xl">
					<div className="flex items-center gap-1.5 border-b border-connexio-border px-2.5 py-1.5">
						<Search size={11} className="text-connexio-text-muted" />
						<input
							ref={inputRef}
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Filter branches or type a ref…"
							className="w-full bg-transparent text-[11px] text-connexio-text outline-none placeholder:text-connexio-text-muted"
						/>
					</div>
					<div className="max-h-44 overflow-y-auto p-1">
						<button
							type="button"
							onClick={() => {
								onSelect("HEAD");
								setOpen(false);
							}}
							className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] hover:bg-connexio-bg-tertiary/60"
						>
							<span className="font-mono text-connexio-accent">HEAD</span>
							<span className="text-connexio-text-muted">(current checkout)</span>
						</button>
						{branches === null && (
							<div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-connexio-text-muted">
								<Loader2 size={10} className="animate-spin" /> Loading…
							</div>
						)}
						{filtered.map((b) => (
							<button
								key={b.name}
								type="button"
								onClick={() => {
									onSelect(b.name);
									setOpen(false);
								}}
								className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] hover:bg-connexio-bg-tertiary/60"
							>
								<span className="truncate font-mono text-connexio-text-secondary">{b.name}</span>
								{b.current && (
									<span className="ml-auto flex-shrink-0 text-[9px] uppercase tracking-wide text-connexio-accent">
										current
									</span>
								)}
								{b.remote && (
									<span className="ml-auto flex-shrink-0 text-[9px] uppercase tracking-wide text-connexio-text-muted">
										remote
									</span>
								)}
							</button>
						))}
						{/* Custom ref entry — free-form SHA/ref */}
						{query.trim() && (
							<button
								type="button"
								onClick={() => {
									onSelect(query.trim());
									setOpen(false);
								}}
								className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] hover:bg-connexio-bg-tertiary/60"
							>
								<span className="text-connexio-text-muted">Use ref:</span>
								<span className="truncate font-mono text-connexio-accent">{query.trim()}</span>
							</button>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
