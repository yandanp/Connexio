import { useCallback } from "react";
import { useWorkspaceStore } from "../workspace";

interface ResizeHandleProps {
	projectId: string;
	tabId: string;
	branchId: string;
	dividerIndex: number;
	direction: "horizontal" | "vertical";
	top: number;
	left: number;
	branchTop: number;
	branchLeft: number;
	branchWidth: number;
	branchHeight: number;
	isVisible: boolean;
}

export default function ResizeHandle({
	projectId,
	tabId,
	branchId,
	dividerIndex,
	direction,
	top,
	left,
	branchTop,
	branchLeft,
	branchWidth,
	branchHeight,
	isVisible,
}: ResizeHandleProps) {
	const { resizeSplitBranch } = useWorkspaceStore();

	const isHorizontal = direction === "horizontal";

	const startResize = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();

			// Find the terminal layer container (the parent div with relative positioning)
			const container =
				(e.target as HTMLElement).closest("[data-terminal-layer-container]") ||
				(e.target as HTMLElement).parentElement?.closest(".relative") ||
				document.body;
			const containerRect = container.getBoundingClientRect();

			const handleMove = (ev: MouseEvent) => {
				// Calculate pointer position as a ratio within the container (0-1)
				const pointerRatio = isHorizontal
					? (ev.clientX - containerRect.left) / containerRect.width
					: (ev.clientY - containerRect.top) / containerRect.height;

				// Convert to ratio within the branch's coordinate space
				const branchStart = isHorizontal ? branchLeft : branchTop;
				const branchSize = isHorizontal ? branchWidth : branchHeight;
				const dividerRatioInBranch = (pointerRatio - branchStart) / branchSize;

				resizeSplitBranch(
					projectId,
					tabId,
					branchId,
					dividerIndex,
					Math.max(0, Math.min(1, dividerRatioInBranch)),
					"absolute",
				);
			};

			const handleUp = () => {
				document.removeEventListener("mousemove", handleMove);
				document.removeEventListener("mouseup", handleUp);
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
			};

			document.body.style.cursor = isHorizontal ? "col-resize" : "row-resize";
			document.body.style.userSelect = "none";
			document.addEventListener("mousemove", handleMove);
			document.addEventListener("mouseup", handleUp);
		},
		[
			isHorizontal,
			branchTop,
			branchLeft,
			branchWidth,
			branchHeight,
			projectId,
			tabId,
			branchId,
			dividerIndex,
			resizeSplitBranch,
		],
	);

	if (!isVisible) return null;

	const style: React.CSSProperties = isHorizontal
		? {
				position: "absolute",
				top: `${top * 100}%`,
				left: `${left * 100}%`,
				width: "7px",
				height: `${branchHeight * 100}%`,
				transform: "translateX(-3px)",
			}
		: {
				position: "absolute",
				top: `${top * 100}%`,
				left: `${branchLeft * 100}%`,
				width: `${branchWidth * 100}%`,
				height: "7px",
				transform: "translateY(-3px)",
			};

	return (
		<div
			style={style}
			className={`z-40 ${isHorizontal ? "cursor-col-resize" : "cursor-row-resize"} group/resize flex items-center justify-center`}
			onMouseDown={startResize}
		>
			<div
				className={`${
					isHorizontal ? "w-[1px] h-full border-l border-r" : "h-[1px] w-full border-t border-b"
				} border-black/25 bg-connexio-border/90 group-hover/resize:bg-connexio-accent/80 group-active/resize:bg-connexio-accent transition-colors`}
			/>
		</div>
	);
}
