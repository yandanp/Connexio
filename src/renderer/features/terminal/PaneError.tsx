import { AlertCircle, RotateCw, X } from "lucide-react";

/**
 * Error UI for a pane that failed to spawn. Contains error message, retry action,
 * and close button. Consumes workspace store actions via public barrel (allowed per
 * feature import boundaries — importing root barrel `features/workspace` is OK).
 */
export default function PaneError({
	message,
	onRetry,
	onClosePane,
}: {
	message: string;
	onRetry: () => Promise<void>;
	onClosePane: () => void;
}) {
	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-connexio-bg p-3 text-sm">
			{/* Header with icon */}
			<div className="mb-2 flex items-start gap-2.5">
				<AlertCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
				<div className="min-w-0 flex-1 overflow-hidden">
					<p className="break-words font-medium text-connexio-text">
						Terminal tidak bisa disiapkan
					</p>
					<p className="mt-0.5 break-words text-[11px] text-connexio-text-secondary">{message}</p>
				</div>
			</div>

			{/* Footer */}
			<div className="mt-auto flex items-center justify-end gap-1.5 border-t border-connexio-border/40 pt-2.5">
				<button
					onClick={(e) => {
						e.stopPropagation();
						onClosePane();
					}}
					className="rounded px-2 py-1 text-[10px] font-medium text-connexio-text-muted hover:text-connexio-text transition-colors"
					type="button"
				>
					Tutup
				</button>
				<button
					onClick={(e) => {
						e.stopPropagation();
						onRetry();
					}}
					className="btn btn-primary flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold transition-all active:scale-[0.98]"
					type="button"
				>
					<RotateCw size={10} className="mr-0.5" />
					Coba lagi
				</button>
			</div>
		</div>
	);
}
