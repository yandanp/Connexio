import { Columns2, Rows2, X } from "lucide-react";
import { useCallback } from "react";
import { useProjectStore } from "../stores/projectStore";
import { computePaneBounds, computeResizeHandleBounds } from "../stores/projectStore";
import { CodeEditor } from "./editor";
import Terminal from "./Terminal";

/**
 * Renders ALL terminal/editor panes from ALL projects.
 * 
 * Key design: ALL terminals are rendered in a FLAT list with stable keys (terminalId).
 * Split layout is computed into absolute CSS bounds (top/left/width/height percentages).
 * Terminals never move in the React tree — only their CSS position changes.
 * This guarantees xterm.js instances never remount.
 */
export default function TerminalLayer() {
	const { workspaceTabs, activeTabIds, activeProjectId } = useProjectStore();

	const allPanes: Array<{
		projectId: string;
		tabId: string;
		paneId: string;
		kind: "terminal" | "editor";
		terminalId: string | null;
		filePath?: string;
		bounds: { top: number; left: number; width: number; height: number };
		isVisible: boolean;
		isActivePane: boolean;
		isSplit: boolean;
	}> = [];

	const allHandles: Array<{
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
	}> = [];

	for (const [projectId, tabs] of Object.entries(workspaceTabs)) {
		for (const tab of tabs) {
			const isProjectActive = projectId === activeProjectId;
			const isTabActive = activeTabIds[projectId] === tab.id;
			const isVisible = isProjectActive && isTabActive;

			if (tab.splitLayout) {
				for (const pb of computePaneBounds(tab.splitLayout.root)) {
					if (pb.kind === "terminal" && pb.terminalId) {
						allPanes.push({
							projectId, tabId: tab.id, paneId: pb.paneId,
							kind: "terminal", terminalId: pb.terminalId,
							bounds: pb, isVisible,
							isActivePane: tab.splitLayout.activePaneId === pb.paneId,
							isSplit: true,
						});
					} else if (pb.kind === "editor" && pb.filePath) {
						allPanes.push({
							projectId, tabId: tab.id, paneId: pb.paneId,
							kind: "editor", terminalId: null, filePath: pb.filePath,
							bounds: pb, isVisible,
							isActivePane: tab.splitLayout.activePaneId === pb.paneId,
							isSplit: true,
						});
					}
				}

				for (const handle of computeResizeHandleBounds(tab.splitLayout.root)) {
					allHandles.push({
						projectId,
						tabId: tab.id,
						branchId: handle.branchId,
						dividerIndex: handle.dividerIndex,
						direction: handle.direction,
						top: handle.top,
						left: handle.left,
						branchTop: handle.branchTop,
						branchLeft: handle.branchLeft,
						branchWidth: handle.branchWidth,
						branchHeight: handle.branchHeight,
						isVisible,
					});
				}
			} else if (tab.terminalId) {
				allPanes.push({
					projectId, tabId: tab.id, paneId: tab.id,
					kind: "terminal", terminalId: tab.terminalId,
					bounds: { top: 0, left: 0, width: 1, height: 1 },
					isVisible, isActivePane: true, isSplit: false,
				});
			}
		}
	}

	return (
		<>
			{allPanes.map((pane) => (
				<PaneRenderer
					key={pane.kind === "terminal" ? pane.terminalId! : `editor-${pane.paneId}`}
					{...pane}
				/>
			))}
			{allHandles.map((handle) => (
				<ResizeHandle
					key={`${handle.projectId}-${handle.tabId}-${handle.branchId}-${handle.dividerIndex}`}
					{...handle}
				/>
			))}
		</>
	);
}

function ResizeHandle({
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
}: {
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
}) {
	const { resizeSplitBranch } = useProjectStore();

	const isHorizontal = direction === "horizontal";

	const startResize = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		// Find the terminal layer container (the parent div with relative positioning)
		const container = (e.target as HTMLElement).closest("[data-terminal-layer-container]") || (e.target as HTMLElement).parentElement?.closest(".relative") || document.body;
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
	}, [isHorizontal, branchTop, branchLeft, branchWidth, branchHeight, projectId, tabId, branchId, dividerIndex, resizeSplitBranch]);

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
					isHorizontal
						? "w-[1px] h-full border-l border-r"
						: "h-[1px] w-full border-t border-b"
				} border-black/25 bg-connexio-border/90 group-hover/resize:bg-connexio-accent/80 group-active/resize:bg-connexio-accent transition-colors`}
			/>
		</div>
	);
}

function PaneRenderer({
	projectId,
	tabId,
	paneId,
	kind,
	terminalId,
	filePath,
	bounds,
	isVisible,
	isActivePane,
	isSplit,
}: {
	projectId: string;
	tabId: string;
	paneId: string;
	kind: "terminal" | "editor";
	terminalId: string | null;
	filePath?: string;
	bounds: { top: number; left: number; width: number; height: number };
	isVisible: boolean;
	isActivePane: boolean;
	isSplit: boolean;
}) {
	const { closeSplitPane, setActiveSplitPane, splitTerminal } = useProjectStore();

	const handleFocus = () => {
		if (isSplit) setActiveSplitPane(projectId, tabId, paneId);
	};

	const handleClose = () => {
		closeSplitPane(projectId, tabId, paneId);
	};

	const style: React.CSSProperties = isVisible
		? {
				position: "absolute",
				top: `${bounds.top * 100}%`,
				left: `${bounds.left * 100}%`,
				width: `${bounds.width * 100}%`,
				height: `${bounds.height * 100}%`,
			}
		: {
				position: "absolute",
				top: 0, left: 0, width: 0, height: 0, overflow: "hidden",
			};

	return (
		<div
			style={style}
			className={!isVisible ? "hidden" : ""}
			onMouseDown={handleFocus}
		>
			{/* Active pane indicator */}
			{isVisible && isSplit && isActivePane && (
				<div className="absolute inset-0 pointer-events-none z-20">
					<div className="absolute inset-0 border border-connexio-accent/50 rounded-[3px]" />
					<div className="absolute inset-0 border border-connexio-accent/20 rounded-[3px] blur-[1px]" />
				</div>
			)}

			{/* Pane toolbar (hover) */}
			{isVisible && isSplit && (
				<div className="absolute top-1.5 right-1.5 z-50 flex items-center gap-0.5 opacity-0 hover:opacity-100 transition-all duration-200 bg-connexio-bg-secondary/90 backdrop-blur-sm rounded-md border border-connexio-border/50 px-1 py-0.5 shadow-lg">
					<button
						onMouseDown={(e) => e.stopPropagation()}
						onClick={(e) => { e.preventDefault(); e.stopPropagation(); splitTerminal(projectId, tabId, paneId, "horizontal"); }}
						className="p-1 rounded hover:bg-connexio-accent/15 transition-colors"
						title="Split Right"
						type="button"
					>
						<Columns2 size={11} className="text-connexio-text-muted hover:text-connexio-accent" />
					</button>
					<button
						onMouseDown={(e) => e.stopPropagation()}
						onClick={(e) => { e.preventDefault(); e.stopPropagation(); splitTerminal(projectId, tabId, paneId, "vertical"); }}
						className="p-1 rounded hover:bg-connexio-accent/15 transition-colors"
						title="Split Down"
						type="button"
					>
						<Rows2 size={11} className="text-connexio-text-muted hover:text-connexio-accent" />
					</button>
					<div className="w-px h-3 bg-connexio-border/40 mx-0.5" />
					<button
						onMouseDown={(e) => e.stopPropagation()}
						onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleClose(); }}
						className="p-1 rounded hover:bg-red-500/15 transition-colors"
						title="Close Pane"
						type="button"
					>
						<X size={11} className="text-connexio-text-muted hover:text-red-400" />
					</button>
				</div>
			)}

			{kind === "terminal" && terminalId && (
				<Terminal terminalId={terminalId} isVisible={isVisible} />
			)}

			{kind === "editor" && filePath && (
				<CodeEditor key={filePath} filePath={filePath} onClose={handleClose} />
			)}
		</div>
	);
}
