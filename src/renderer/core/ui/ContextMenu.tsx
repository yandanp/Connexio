import type { LucideIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ContextMenuItem = {
	label: string;
	onClick: () => void | Promise<void>;
	icon?: LucideIcon;
	shortcut?: string;
	danger?: boolean;
	disabled?: boolean;
};

type ContextMenuEntry = ContextMenuItem | "separator";

interface ContextMenuProps {
	x: number;
	y: number;
	items: ContextMenuEntry[];
	onClose: () => void;
	minWidth?: number;
	className?: string;
	dataAttribute?: string;
}

const VIEWPORT_PADDING = 8;

function clampPosition(x: number, y: number, width = 176, height = 0) {
	return {
		x: Math.max(VIEWPORT_PADDING, Math.min(x, window.innerWidth - width - VIEWPORT_PADDING)),
		y: Math.max(VIEWPORT_PADDING, Math.min(y, window.innerHeight - height - VIEWPORT_PADDING)),
	};
}

export default function ContextMenu({
	x,
	y,
	items,
	onClose,
	minWidth = 176,
	className = "",
	dataAttribute,
}: ContextMenuProps) {
	const menuRef = useRef<HTMLDivElement>(null);
	const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
	const [position, setPosition] = useState(() => clampPosition(x, y, minWidth));
	const [activeIndex, setActiveIndex] = useState(() =>
		items.findIndex((item) => item !== "separator" && !item.disabled),
	);

	useLayoutEffect(() => {
		const rect = menuRef.current?.getBoundingClientRect();
		const next = clampPosition(x, y, rect?.width ?? minWidth, rect?.height ?? 0);
		setPosition((current) => (current.x === next.x && current.y === next.y ? current : next));
	}, [x, y, minWidth]);

	useEffect(() => {
		const enabledIndices = items
			.map((item, index) => (item !== "separator" && !item.disabled ? index : -1))
			.filter((index) => index >= 0);

		const handlePointerDown = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				onClose();
			}
		};
		const handleKeyDown = async (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose();
				return;
			}
			if (enabledIndices.length === 0) return;

			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault();
				const currentEnabledIndex = enabledIndices.indexOf(activeIndex);
				const direction = event.key === "ArrowDown" ? 1 : -1;
				const nextEnabledIndex =
					currentEnabledIndex === -1
						? 0
						: (currentEnabledIndex + direction + enabledIndices.length) % enabledIndices.length;
				const nextIndex = enabledIndices[nextEnabledIndex];
				setActiveIndex(nextIndex);
				itemRefs.current[nextIndex]?.focus();
				return;
			}

			if (event.key === "Enter" || event.key === " ") {
				const item = items[activeIndex];
				if (item && item !== "separator" && !item.disabled) {
					event.preventDefault();
					await item.onClick();
					onClose();
				}
			}
		};

		document.addEventListener("mousedown", handlePointerDown);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [activeIndex, items, onClose]);

	const menu = (
		<div
			ref={menuRef}
			role="menu"
			{...(dataAttribute ? { [dataAttribute]: "" } : {})}
			className={`fixed z-[9999] rounded-lg border border-connexio-border bg-connexio-bg-secondary py-1 shadow-lg ring-1 ring-black/10 ${className}`}
			style={{ left: position.x, top: position.y, minWidth }}
			onClick={(event) => event.stopPropagation()}
			onMouseDown={(event) => event.stopPropagation()}
			onContextMenu={(event) => event.preventDefault()}
		>
			{items.map((item, index) => {
				if (item === "separator") {
					return <div key={`separator-${index}`} className="my-1 h-px bg-connexio-border" />;
				}

				const Icon = item.icon;
				return (
					<button
						key={`${item.label}-${index}`}
						ref={(node) => {
							itemRefs.current[index] = node;
						}}
						role="menuitem"
						disabled={item.disabled}
						onClick={async () => {
							if (item.disabled) return;
							await item.onClick();
							onClose();
						}}
						onMouseEnter={() => {
							if (!item.disabled) setActiveIndex(index);
						}}
						className={`group flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12px] outline-none transition-colors disabled:cursor-not-allowed disabled:text-connexio-text-muted/40 ${
							item.danger
								? "text-red-400 hover:bg-red-500/10 hover:text-red-300 focus:bg-red-500/10 focus:text-red-300"
								: "text-connexio-text-secondary hover:bg-connexio-bg-tertiary hover:text-connexio-text focus:bg-connexio-bg-tertiary focus:text-connexio-text"
						} ${activeIndex === index ? (item.danger ? "bg-red-500/10 text-red-300" : "bg-connexio-bg-tertiary text-connexio-text") : ""}`}
						type="button"
					>
						<span className="flex h-4 w-4 items-center justify-center text-connexio-text-muted group-hover:text-current">
							{Icon ? <Icon size={13} /> : null}
						</span>
						<span className="flex-1 whitespace-nowrap">{item.label}</span>
						{item.shortcut && (
							<span className="ml-4 text-[10px] text-connexio-text-muted">{item.shortcut}</span>
						)}
					</button>
				);
			})}
		</div>
	);

	return createPortal(menu, document.body);
}
