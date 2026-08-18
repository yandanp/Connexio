import { AlertTriangle } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface Props {
	title: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	variant?: "danger" | "warning" | "default";
	onConfirm: () => void;
	onCancel: () => void;
}

export default function ConfirmDialog({
	title,
	message,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	variant = "warning",
	onConfirm,
	onCancel,
}: Props) {
	const confirmBtnRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		// Focus confirm button on mount
		confirmBtnRef.current?.focus();

		// Close on Escape
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				onCancel();
			} else if (e.key === "Enter") {
				e.preventDefault();
				onConfirm();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [onCancel, onConfirm]);

	const confirmBtnClass =
		variant === "danger"
			? "bg-red-600 hover:bg-red-700 text-white"
			: variant === "warning"
				? "bg-orange-600 hover:bg-orange-700 text-white"
				: "bg-connexio-accent hover:bg-connexio-accent-hover text-white";

	// Portalled to document.body: callers render this inside sidebars whose
	// transform/backdrop-filter create a containing block that would otherwise
	// pin the dialog off-center.
	return createPortal(
		<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
			<div className="bg-connexio-bg-secondary border border-connexio-border rounded-lg w-[360px] shadow-2xl overflow-hidden">
				{/* Header */}
				<div className="flex items-center gap-2.5 px-4 py-3 border-b border-connexio-border">
					<AlertTriangle
						size={16}
						className={
							variant === "danger"
								? "text-red-400"
								: variant === "warning"
									? "text-orange-400"
									: "text-connexio-accent"
						}
					/>
					<h3 className="text-sm font-semibold text-connexio-text flex-1">{title}</h3>
				</div>

				{/* Body */}
				<div className="px-4 py-3">
					<p className="text-xs text-connexio-text-secondary whitespace-pre-line leading-relaxed">
						{message}
					</p>
				</div>

				{/* Actions */}
				<div className="flex justify-end gap-2 px-4 py-3 border-t border-connexio-border bg-connexio-bg">
					<button
						type="button"
						onClick={onCancel}
						className="px-3 py-1.5 text-xs font-medium text-connexio-text-secondary rounded-lg hover:bg-white/[0.04] transition-colors"
					>
						{cancelLabel}
					</button>
					<button
						ref={confirmBtnRef}
						type="button"
						onClick={onConfirm}
						className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${confirmBtnClass}`}
					>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
