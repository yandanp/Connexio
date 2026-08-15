import { Loader2 } from "lucide-react";

/**
 * Loading skeleton shown inside a pane while its terminal spawn is in-flight
 * (terminalId == null, no error). Rendered by TerminalLayer's PaneRenderer.
 */
export default function PendingPane() {
	return (
		<div className="flex h-full w-full flex-col gap-2 overflow-hidden bg-connexio-bg p-3">
			{/* Prompt line skeleton */}
			<div className="flex items-center gap-2">
				<span className="h-2.5 w-2.5 flex-shrink-0 animate-pulse rounded-[2px] bg-connexio-text-muted/30" />
				<span className="h-2 w-16 animate-pulse rounded bg-connexio-text-muted/20" />
			</div>
			{/* Output lines skeleton */}
			<div className="mt-1 flex flex-col gap-1.5">
				<span className="h-2 w-[72%] animate-pulse rounded bg-connexio-text-muted/10" />
				<span className="h-2 w-[54%] animate-pulse rounded bg-connexio-text-muted/10" />
				<span className="h-2 w-[63%] animate-pulse rounded bg-connexio-text-muted/10" />
			</div>
			{/* Status */}
			<div className="mt-auto flex items-center justify-center gap-1.5 pt-3 text-connexio-text-muted">
				<Loader2 size={11} className="animate-spin" />
				<span className="text-[11px]">Menyiapkan shell…</span>
			</div>
		</div>
	);
}
