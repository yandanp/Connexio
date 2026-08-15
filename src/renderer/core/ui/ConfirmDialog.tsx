import { AlertTriangle } from "lucide-react";
import { useEffect, useRef } from "react";

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

	return (
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
					<h3 className="text-sm font-semibold text-connexio-text">{title}</h3>
				</div>

				{/* Body */}
				<div className="px-4 py-3">
					<p className="text-xs text-connexio-text-secondary leading-relaxed">{message}</p>
				</div>

				{/* Footer */}
				<div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-connexio-border bg-connexio-bg-tertiary/50">
					<button
						onClick={onCancel}
						className="px-3 py-1.5 text-xs font-medium text-connexio-text-secondary bg-connexio-bg-tertiary border border-connexio-border rounded hover:bg-connexio-bg hover:text-connexio-text transition-colors"
						type="button"
					>
						{cancelLabel}
					</button>
					<button
						ref={confirmBtnRef}
						onClick={onConfirm}
						className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${confirmBtnClass}`}
						type="button"
					>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>
	);
}
