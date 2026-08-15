import { Columns2, Rows2, X } from "lucide-react";
import { useEffect } from "react";
import { useProjectsStore } from "../projects";
import { computePaneBounds, computeResizeHandleBounds, useWorkspaceStore } from "../workspace";
import { CodeEditor } from "../editor";
import Terminal from "./Terminal";
import PendingPane from "./PendingPane";
import PaneError from "./PaneError";
import ResizeHandle from "./ResizeHandle";
import { shouldTriggerSpawn } from "./activation-trigger";
/**
 * Renders ALL terminal/editor panes from ALL projects.
 *
 * Key design: ALL panes use paneId as their stable React key — the key never
 * changes when a lazy pane's terminalId materializes, so xterm instances and
 * pane wrappers never remount. Split layout is computed into absolute CSS
 * bounds (top/left/width/height percentages). Terminals never move in the
 * React tree — only their CSS position changes.
 */
export default function TerminalLayer() {
	const { workspaceTabs, activeTabIds, spawningTabs, paneErrors, ensureTerminalSpawned } =
		useWorkspaceStore();
	const { activeProjectId } = useProjectsStore();

	// Lazy-pane activation: when the visible tab has terminal leaves that are
	// still null (and not failed), fire ensureTerminalSpawned. Idempotent
	// (in-flight map in the store), so StrictMode double-invocation is safe.
	useEffect(() => {
		if (!activeProjectId) return;
		const tabId = activeTabIds[activeProjectId];
		if (!tabId) return;
		const should = shouldTriggerSpawn(
			{ spawningTabs, paneErrors, workspaceTabs, activeProjectId, activeTabIds },
			activeProjectId,
			tabId,
		);
		if (should) void ensureTerminalSpawned(activeProjectId, tabId);
	});

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
					if (pb.kind === "terminal") {
						allPanes.push({
							projectId,
							tabId: tab.id,
							paneId: pb.paneId,
							kind: "terminal",
							terminalId: pb.terminalId,
							bounds: pb,
							isVisible,
							isActivePane: tab.splitLayout.activePaneId === pb.paneId,
							isSplit: true,
						});
					} else if (pb.kind === "editor" && pb.filePath) {
						allPanes.push({
							projectId,
							tabId: tab.id,
							paneId: pb.paneId,
							kind: "editor",
							terminalId: null,
							filePath: pb.filePath,
							bounds: pb,
							isVisible,
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
			} else if (tab.type === "terminal") {
				allPanes.push({
					projectId,
					tabId: tab.id,
					paneId: tab.id,
					kind: "terminal",
					terminalId: tab.terminalId,
					bounds: { top: 0, left: 0, width: 1, height: 1 },
					isVisible,
					isActivePane: true,
					isSplit: false,
				});
			}
		}
	}

	return (
		<>
			{allPanes.map((pane) => (
				<PaneRenderer key={pane.paneId} {...pane} />
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
	const { closeSplitPane, closeTerminalTab, retryPaneSpawn, setActiveSplitPane, splitTerminal } =
		useWorkspaceStore();
	const paneError = useWorkspaceStore((s) => s.paneErrors[paneId]);

	const handleFocus = () => {
		if (isSplit) setActiveSplitPane(projectId, tabId, paneId);
	};

	const handleClose = () => {
		if (isSplit) return closeSplitPane(projectId, tabId, paneId);
		return closeTerminalTab(projectId, tabId);
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
				top: 0,
				left: 0,
				width: 1,
				height: 1,
				overflow: "hidden",
				visibility: "hidden",
				pointerEvents: "none",
			};

	return (
		<div style={style} onMouseDown={handleFocus}>
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
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							splitTerminal(projectId, tabId, paneId, "horizontal");
						}}
						className="p-1 rounded hover:bg-connexio-accent/15 transition-colors"
						title="Split Right"
						type="button"
					>
						<Columns2 size={11} className="text-connexio-text-muted hover:text-connexio-accent" />
					</button>
					<button
						onMouseDown={(e) => e.stopPropagation()}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							splitTerminal(projectId, tabId, paneId, "vertical");
						}}
						className="p-1 rounded hover:bg-connexio-accent/15 transition-colors"
						title="Split Down"
						type="button"
					>
						<Rows2 size={11} className="text-connexio-text-muted hover:text-connexio-accent" />
					</button>
					<div className="w-px h-3 bg-connexio-border/40 mx-0.5" />
					<button
						onMouseDown={(e) => e.stopPropagation()}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							handleClose();
						}}
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

			{kind === "terminal" && !terminalId && paneError && (
				<PaneError
					message={paneError}
					onRetry={() => retryPaneSpawn(projectId, tabId, paneId)}
					onClosePane={handleClose}
				/>
			)}

			{kind === "terminal" && !terminalId && !paneError && <PendingPane />}

			{kind === "editor" && filePath && (
				<CodeEditor key={filePath} filePath={filePath} onClose={handleClose} />
			)}
		</div>
	);
}
