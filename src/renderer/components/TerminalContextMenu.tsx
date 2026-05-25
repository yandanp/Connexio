import { ClipboardPaste, Copy } from "lucide-react";
import { useEffect, useRef } from "react";

interface Props {
	x: number;
	y: number;
	hasSelection: boolean;
	onCopy: () => void;
	onPaste: () => void;
	onClose: () => void;
}

export default function TerminalContextMenu({
	x,
	y,
	hasSelection,
	onCopy,
	onPaste,
	onClose,
}: Props) {
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onClose();
			}
		};

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};

		// Delay to avoid immediate close from the contextmenu event
		const timer = setTimeout(() => {
			document.addEventListener("mousedown", handleClickOutside);
			document.addEventListener("keydown", handleKeyDown);
		}, 0);

		return () => {
			clearTimeout(timer);
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [onClose]);

	// Adjust position to stay within viewport
	const adjustedStyle = () => {
		const menuWidth = 160;
		const menuHeight = 80;
		let adjustedX = x;
		let adjustedY = y;

		if (x + menuWidth > window.innerWidth) {
			adjustedX = window.innerWidth - menuWidth - 8;
		}
		if (y + menuHeight > window.innerHeight) {
			adjustedY = window.innerHeight - menuHeight - 8;
		}

		return { left: adjustedX, top: adjustedY };
	};

	return (
		<div
			ref={menuRef}
			className="fixed z-[200] bg-connexio-bg-secondary border border-connexio-border rounded-lg shadow-2xl py-1 min-w-[150px] overflow-hidden"
			style={adjustedStyle()}
		>
			{/* Copy */}
			<button
				onClick={() => {
					onCopy();
					onClose();
				}}
				disabled={!hasSelection}
				className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
					hasSelection
						? "text-connexio-text-secondary hover:bg-connexio-bg-tertiary hover:text-connexio-text"
						: "text-connexio-text-muted/40 cursor-not-allowed"
				}`}
				type="button"
			>
				<Copy size={12} />
				<span className="text-xs">Copy</span>
				<span className="ml-auto text-[10px] text-connexio-text-muted">
					Ctrl+C
				</span>
			</button>

			{/* Paste */}
			<button
				onClick={() => {
					onPaste();
					onClose();
				}}
				className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-connexio-text-secondary hover:bg-connexio-bg-tertiary hover:text-connexio-text transition-colors"
				type="button"
			>
				<ClipboardPaste size={12} />
				<span className="text-xs">Paste</span>
				<span className="ml-auto text-[10px] text-connexio-text-muted">
					Ctrl+Shift+V
				</span>
			</button>
		</div>
	);
}
